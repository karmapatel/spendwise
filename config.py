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

import os
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# Load environment variables from .env file if present
load_dotenv(os.path.join(BASE_DIR, '.env'))

def get_database_uri():
    raw_uri = os.environ.get('DATABASE_URL', '').strip()
    if not raw_uri:
        # Default fallback to local SQLite database
        return f"sqlite:///{os.path.join(BASE_DIR, 'spendwise.db')}"
    
    # SQLAlchemy 1.4+ and 2.0+ require 'postgresql://' instead of 'postgres://'
    if raw_uri.startswith('postgres://'):
        raw_uri = raw_uri.replace('postgres://', 'postgresql://', 1)
    
    return raw_uri

def get_session_cookie_secure():
    raw = os.environ.get('SESSION_COOKIE_SECURE')
    if raw is not None and raw.strip() != '':
        return raw.strip().lower() in ('true', '1')
    # Default to None so PwaSessionInterface can dynamically secure HTTPS requests
    return None

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'spendwise_super_secret_key_2026')
    SQLALCHEMY_DATABASE_URI = get_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Engine options for Supabase cloud PostgreSQL connection stability
    # Optimized for a small personal Expense Monitoring application with low connection usage
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 1800,
        "pool_size": 3,
        "max_overflow": 2,
        "pool_timeout": 30,
    }

    # Session cookie configuration (Persistent 30-day session)
    SESSION_COOKIE_NAME = 'spendwise_session'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)
    SESSION_COOKIE_SECURE = get_session_cookie_secure()

    # Supabase Client configuration
    SUPABASE_URL = os.environ.get('SUPABASE_URL', '').strip() or None
    SUPABASE_KEY = (
        os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
        or os.environ.get('SUPABASE_KEY', '').strip()
        or os.environ.get('SUPABASE_ANON_KEY', '').strip()
        or None
    )
