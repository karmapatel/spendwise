# Copyright (C) 2026 Karma Patel karmapatel4@gmail.com
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://gnu.org>.

import io
import csv
from datetime import datetime, date, timedelta
import calendar
from flask import Flask, render_template, request, jsonify, session, Response, send_from_directory
from flask.sessions import SecureCookieSessionInterface
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_cors import CORS
from sqlalchemy import text
from config import Config
from models import db, bcrypt, User, Transaction, DEFAULT_CATEGORIES, ist_now, IST

class PwaSessionInterface(SecureCookieSessionInterface):
    """Dynamic session interface: sets Secure on cookies over HTTPS/reverse proxies, allows plain HTTP in local dev."""
    def get_cookie_secure(self, app):
        val = app.config.get('SESSION_COOKIE_SECURE')
        if val is not None:
            return val
        return request.is_secure

app = Flask(__name__)
app.config.from_object(Config)
app.session_interface = PwaSessionInterface()
# Enable reverse proxy header awareness (Vercel, Render, Nginx, Cloudflare)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

CORS(app)
db.init_app(app)
bcrypt.init_app(app)

# Helper: Get current authenticated user
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    return db.session.get(User, user_id)

# -------------------------------------------------------------
# PWA & Service Worker Routes
# -------------------------------------------------------------
@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json', mimetype='application/manifest+json')

@app.route('/sw.js')
def service_worker():
    response = send_from_directory('static', 'sw.js', mimetype='application/javascript')
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

# -------------------------------------------------------------
# System Health & Backend Monitoring Endpoint
# -------------------------------------------------------------
@app.route('/health', methods=['GET'])
def health_check():
    db_status = 'ok'
    error_msg = None
    status_code = 200
    try:
        db.session.execute(text('SELECT 1'))
    except Exception as e:
        db_status = 'error'
        error_msg = str(e)
        status_code = 503

    return jsonify({
        'status': 'healthy' if db_status == 'ok' else 'degraded',
        'backend': 'ok',
        'database': db_status,
        'error': error_msg,
        'timestamp': datetime.now(IST).isoformat()
    }), status_code

# -------------------------------------------------------------
# Web Page Route
# -------------------------------------------------------------
@app.route('/')
def index():
    return render_template('index.html')

# -------------------------------------------------------------
# Authentication API
# -------------------------------------------------------------
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required.'}), 400

    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters long.'}), 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({'error': 'An account with this email already exists.'}), 409

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    session.permanent = True
    session['user_id'] = user.id
    return jsonify({
        'status': 'success',
        'message': 'Registration successful.',
        'user': user.to_dict()
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    session.permanent = True
    session['user_id'] = user.id
    return jsonify({
        'status': 'success',
        'message': 'Login successful.',
        'user': user.to_dict()
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'status': 'success', 'message': 'Logged out successfully.'})

@app.route('/api/auth/me', methods=['GET'])
def get_me():
    user = get_current_user()
    if not user:
        return jsonify({'authenticated': False}), 401
    return jsonify({
        'authenticated': True,
        'user': user.to_dict()
    })

@app.route('/api/auth/profile', methods=['PUT'])
def update_profile():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    if 'name' in data and data['name'].strip():
        user.name = data['name'].strip()
    if 'monthly_budget' in data:
        try:
            user.monthly_budget = float(data['monthly_budget'])
        except (ValueError, TypeError):
            pass
    if 'currency' in data and data['currency'].strip():
        user.currency = data['currency'].strip()

    db.session.commit()
    return jsonify({
        'status': 'success',
        'message': 'Profile updated.',
        'user': user.to_dict()
    })

# -------------------------------------------------------------
# Categories API
# -------------------------------------------------------------
@app.route('/api/categories', methods=['GET'])
def get_categories():
    return jsonify(DEFAULT_CATEGORIES)

# -------------------------------------------------------------
# Transactions API (Strictly User Isolated)
# -------------------------------------------------------------
@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    query = Transaction.query.filter_by(user_id=user.id)

    # Filtering
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    tx_type = request.args.get('type')
    category = request.args.get('category')
    payment_method = request.args.get('payment_method')
    search = request.args.get('search')

    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if tx_type and tx_type.lower() in ['expense', 'income']:
        query = query.filter(Transaction.type == tx_type.lower())
    if category and category.lower() != 'all categories' and category != '':
        query = query.filter(Transaction.category == category)
    if payment_method and payment_method.lower() != 'all methods' and payment_method != '':
        query = query.filter(Transaction.payment_method == payment_method)
    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            (Transaction.merchant.ilike(search_fmt)) |
            (Transaction.category.ilike(search_fmt)) |
            (Transaction.notes.ilike(search_fmt))
        )

    # Sort: most recent date & time first
    transactions = query.order_by(Transaction.date.desc(), Transaction.time.desc(), Transaction.id.desc()).all()
    return jsonify([t.to_dict() for t in transactions])

@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    merchant = data.get('merchant', '').strip()
    amount_raw = data.get('amount')
    tx_type = data.get('type', 'expense').lower()
    category = data.get('category', 'Others & Misc')
    payment_method = data.get('payment_method', 'UPI')
    tx_date = data.get('date') or datetime.now(IST).strftime('%Y-%m-%d')
    tx_time = data.get('time') or datetime.now(IST).strftime('%H:%M')
    notes = data.get('notes', '')

    if not merchant:
        return jsonify({'error': 'Merchant or description is required.'}), 400

    try:
        amount = float(amount_raw)
        if amount <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'error': 'Please enter a valid amount greater than 0.'}), 400

    if tx_type not in ['expense', 'income']:
        tx_type = 'expense'

    # Deduplication Guard: Check if an identical transaction was recorded in the last 15 seconds
    cutoff_time = ist_now() - timedelta(seconds=15)
    recent_dup = Transaction.query.filter(
        Transaction.user_id == user.id,
        Transaction.merchant == merchant,
        Transaction.amount == amount,
        Transaction.type == tx_type,
        Transaction.category == category,
        Transaction.payment_method == payment_method,
        Transaction.date == tx_date,
        Transaction.created_at >= cutoff_time
    ).first()

    if recent_dup:
        return jsonify({
            'status': 'success',
            'message': 'Transaction already recorded.',
            'transaction': recent_dup.to_dict()
        }), 200

    tx = Transaction(
        user_id=user.id,
        merchant=merchant,
        amount=amount,
        type=tx_type,
        category=category,
        payment_method=payment_method,
        date=tx_date,
        time=tx_time,
        notes=notes
    )
    db.session.add(tx)
    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': 'Transaction recorded successfully.',
        'transaction': tx.to_dict()
    }), 201

@app.route('/api/transactions/<int:tx_id>', methods=['PUT'])
def update_transaction(tx_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    tx = Transaction.query.filter_by(id=tx_id, user_id=user.id).first()
    if not tx:
        return jsonify({'error': 'Transaction not found.'}), 404

    data = request.get_json() or {}
    if 'merchant' in data and data['merchant'].strip():
        tx.merchant = data['merchant'].strip()
    if 'amount' in data:
        try:
            amt = float(data['amount'])
            if amt > 0:
                tx.amount = amt
        except (ValueError, TypeError):
            pass
    if 'type' in data and data['type'] in ['expense', 'income']:
        tx.type = data['type']
    if 'category' in data and data['category'].strip():
        tx.category = data['category'].strip()
    if 'payment_method' in data and data['payment_method'].strip():
        tx.payment_method = data['payment_method'].strip()
    if 'date' in data and data['date']:
        tx.date = data['date']
    if 'time' in data and data['time']:
        tx.time = data['time']
    if 'notes' in data:
        tx.notes = data['notes']

    db.session.commit()
    return jsonify({
        'status': 'success',
        'message': 'Transaction updated successfully.',
        'transaction': tx.to_dict()
    })

@app.route('/api/transactions/<int:tx_id>', methods=['DELETE'])
def delete_transaction(tx_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    tx = Transaction.query.filter_by(id=tx_id, user_id=user.id).first()
    if not tx:
        return jsonify({'error': 'Transaction not found.'}), 404

    db.session.delete(tx)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Transaction deleted.'})

# -------------------------------------------------------------
# Analytics & Period Stats API
# -------------------------------------------------------------
@app.route('/api/transactions/stats', methods=['GET'])
def get_period_stats():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    # Date range filters (defaults to current month if not specified)
    today = datetime.now(IST).date()
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date or not end_date:
        # Default to current month
        start_date = today.replace(day=1).strftime('%Y-%m-%d')
        last_day = calendar.monthrange(today.year, today.month)[1]
        end_date = today.replace(day=last_day).strftime('%Y-%m-%d')

    # All-time calculations for overall balance
    all_time_income = db.session.query(db.func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == 'income'
    ).scalar() or 0.0

    all_time_expense = db.session.query(db.func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id,
        Transaction.type == 'expense'
    ).scalar() or 0.0

    current_balance = all_time_income - all_time_expense

    # Period-specific calculations
    period_txs = Transaction.query.filter(
        Transaction.user_id == user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).all()

    period_income = sum(t.amount for t in period_txs if t.type == 'income')
    period_expense = sum(t.amount for t in period_txs if t.type == 'expense')
    net_cashflow = period_income - period_expense

    credit_count = sum(1 for t in period_txs if t.type == 'income')
    debit_count = sum(1 for t in period_txs if t.type == 'expense')

    # Category breakdown (expenses only)
    category_map = {}
    for t in period_txs:
        if t.type == 'expense':
            if t.category not in category_map:
                category_map[t.category] = {'total': 0.0, 'count': 0}
            category_map[t.category]['total'] += t.amount
            category_map[t.category]['count'] += 1

    category_palette = {cat['name']: cat for cat in DEFAULT_CATEGORIES}

    category_breakdown = []
    for cat_name, data in sorted(category_map.items(), key=lambda x: x[1]['total'], reverse=True):
        pct = (data['total'] / period_expense * 100) if period_expense > 0 else 0
        cat_info = category_palette.get(cat_name, {'icon': 'category', 'color': '#00685f'})
        category_breakdown.append({
            'category': cat_name,
            'total': data['total'],
            'count': data['count'],
            'percentage': round(pct, 1),
            'icon': cat_info.get('icon', 'category'),
            'color': cat_info.get('color', '#00685f')
        })

    # Daily Outflow aggregation for Calendar & Velocity
    daily_outflows = {}
    daily_counts = {}
    for t in period_txs:
        if t.type == 'expense':
            daily_outflows[t.date] = daily_outflows.get(t.date, 0.0) + t.amount
        daily_counts[t.date] = daily_counts.get(t.date, 0) + 1

    # Peak outflow day
    peak_day = {'date': None, 'amount': 0.0, 'count': 0}
    for d, amt in daily_outflows.items():
        if amt > peak_day['amount']:
            peak_day = {'date': d, 'amount': amt, 'count': daily_counts.get(d, 0)}

    # Daily Average calculation
    try:
        dt_start = datetime.strptime(start_date, '%Y-%m-%d')
        dt_end = datetime.strptime(end_date, '%Y-%m-%d')
        num_days = max(1, (dt_end - dt_start).days + 1)
    except Exception:
        num_days = 30

    daily_avg_outflow = period_expense / num_days if num_days > 0 else 0.0

    # Zero spend days in period
    zero_spend_days = 0
    curr = dt_start
    curr_today_ist = datetime.now(IST).date()
    while curr.date() <= dt_end.date() and curr.date() <= curr_today_ist:
        d_str = curr.strftime('%Y-%m-%d')
        if daily_outflows.get(d_str, 0.0) == 0.0:
            zero_spend_days += 1
        curr += timedelta(days=1)

    # Remaining monthly cap
    monthly_budget = user.monthly_budget or 35000.0
    remaining_cap = max(0.0, monthly_budget - period_expense)
    budget_usage_pct = round((period_expense / monthly_budget * 100), 1) if monthly_budget > 0 else 0.0

    return jsonify({
        'currency': user.currency,
        'current_balance': current_balance,
        'all_time_income': all_time_income,
        'all_time_expense': all_time_expense,
        'period_income': period_income,
        'period_expense': period_expense,
        'net_cashflow': net_cashflow,
        'credit_count': credit_count,
        'debit_count': debit_count,
        'total_records': len(period_txs),
        'monthly_budget': monthly_budget,
        'remaining_cap': remaining_cap,
        'budget_usage_pct': budget_usage_pct,
        'daily_avg_outflow': round(daily_avg_outflow, 2),
        'peak_day': peak_day,
        'zero_spend_days': zero_spend_days,
        'category_breakdown': category_breakdown,
        'daily_outflows': daily_outflows,
        'daily_counts': daily_counts,
        'start_date': start_date,
        'end_date': end_date
    })

# -------------------------------------------------------------
# CSV Export Endpoint
# -------------------------------------------------------------
@app.route('/api/transactions/export', methods=['GET'])
def export_csv():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    query = Transaction.query.filter_by(user_id=user.id)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    tx_type = request.args.get('type')
    category = request.args.get('category')
    payment_method = request.args.get('payment_method')
    search = request.args.get('search')

    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if tx_type and tx_type.lower() in ['expense', 'income']:
        query = query.filter(Transaction.type == tx_type.lower())
    if category and category.lower() != 'all categories' and category != '':
        query = query.filter(Transaction.category == category)
    if payment_method and payment_method.lower() != 'all methods' and payment_method != '':
        query = query.filter(Transaction.payment_method == payment_method)
    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            (Transaction.merchant.ilike(search_fmt)) |
            (Transaction.category.ilike(search_fmt)) |
            (Transaction.notes.ilike(search_fmt))
        )

    txs = query.order_by(Transaction.date.desc(), Transaction.time.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Date', 'Time', 'Merchant / Description', 'Type', 'Category', 'Payment Method', 'Amount', 'Currency', 'Notes'])

    for t in txs:
        writer.writerow([
            t.id,
            t.date,
            t.time,
            t.merchant,
            t.type.upper(),
            t.category,
            t.payment_method,
            f"{t.amount:.2f}",
            user.currency,
            t.notes or ''
        ])

    csv_data = output.getvalue()
    filename = f"SpendWise_Transactions_{datetime.now(IST).strftime('%Y%m%d')}.csv"
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment;filename={filename}'}
    )

# -------------------------------------------------------------
# Database Setup & Initial Seed
# -------------------------------------------------------------
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)

