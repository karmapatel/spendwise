from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

db = SQLAlchemy()
bcrypt = Bcrypt()

DEFAULT_CATEGORIES = [
    {"name": "Food & Dining", "icon": "restaurant", "color": "#00685f", "type": "expense"},
    {"name": "Bills & Utilities", "icon": "wifi", "color": "#17684e", "type": "expense"},
    {"name": "Shopping", "icon": "shopping_bag", "color": "#008378", "type": "expense"},
    {"name": "Transport", "icon": "directions_car", "color": "#565e74", "type": "expense"},
    {"name": "Entertainment", "icon": "movie", "color": "#378166", "type": "expense"},
    {"name": "Health & Fitness", "icon": "fitness_center", "color": "#6bd8cb", "type": "expense"},
    {"name": "Salary & Income", "icon": "payments", "color": "#00685f", "type": "income"},
    {"name": "Freelance", "icon": "work", "color": "#17684e", "type": "income"},
    {"name": "Investment", "icon": "trending_up", "color": "#008378", "type": "income"},
    {"name": "Others & Misc", "icon": "more_horiz", "color": "#bec6e0", "type": "expense"}
]

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    monthly_budget = db.Column(db.Float, default=35000.0)
    currency = db.Column(db.String(10), default='₹')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    transactions = db.relationship('Transaction', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'monthly_budget': self.monthly_budget,
            'currency': self.currency,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    date = db.Column(db.String(10), nullable=False, index=True)  # YYYY-MM-DD
    time = db.Column(db.String(8), nullable=False, default='12:00')  # HH:MM
    merchant = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(20), nullable=False, default='expense')  # 'expense' or 'income'
    category = db.Column(db.String(100), nullable=False, index=True)
    payment_method = db.Column(db.String(50), nullable=False, default='UPI')
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'date': self.date,
            'time': self.time,
            'merchant': self.merchant,
            'amount': self.amount,
            'type': self.type,
            'category': self.category,
            'payment_method': self.payment_method,
            'notes': self.notes or '',
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
