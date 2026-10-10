import uuid
from datetime import datetime
from passlib.context import CryptContext
import psycopg2

DATABASE_URL = "postgresql://postgres@localhost:5432/dealers"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def repair_and_seed():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # 1. Rename column password to hashed_password if it exists
        try:
            cur.execute("ALTER TABLE users RENAME COLUMN password TO hashed_password")
            conn.commit()
            print("Renamed column 'password' to 'hashed_password' in users table.")
        except Exception:
            conn.rollback()  # Ignore if already renamed

        # 2. Add missing columns to users table
        columns_to_add = [
            ("subscription_plan", "TEXT NOT NULL DEFAULT 'free'"),
            ("subscription_status", "TEXT NOT NULL DEFAULT 'active'"),
            ("stripe_customer_id", "TEXT"),
            ("stripe_subscription_id", "TEXT"),
            ("quota_used", "INTEGER NOT NULL DEFAULT 0"),
        ]

        for col_name, col_type in columns_to_add:
            try:
                cur.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                conn.commit()
                print(f"Verified/added column '{col_name}' to users table.")
            except Exception as col_err:
                conn.rollback()
                print(f"Error checking/adding column {col_name}: {col_err}")

        # 3. Drop company column from users table
        try:
            cur.execute("ALTER TABLE users DROP COLUMN IF EXISTS company")
            conn.commit()
            print("Dropped column 'company' from users table.")
        except Exception as drop_err:
            conn.rollback()
            print(f"Error dropping company column: {drop_err}")

        # 4. Clean up old 'admin' username user if it exists
        try:
            cur.execute("DELETE FROM users WHERE email = %s", ("admin",))
            conn.commit()
            print("Cleaned up old 'admin' user placeholder.")
        except Exception:
            conn.rollback()

        # 5. Check if admin@gmail.com user already exists
        cur.execute("SELECT id FROM users WHERE email = %s", ("admin@gmail.com",))
        exists = cur.fetchone()
        
        hashed_pwd = pwd_context.hash("admin")
        if exists:
            print("Admin user 'admin@gmail.com' already exists. Updating password to 'admin'...")
            cur.execute(
                "UPDATE users SET hashed_password = %s, name = %s, subscription_plan = 'enterprise' WHERE email = %s",
                (hashed_pwd, "admin", "admin@gmail.com")
            )
            conn.commit()
            print("Password updated successfully.")
        else:
            print("Seeding admin user 'admin@gmail.com'...")
            user_id = str(uuid.uuid4())
            now = datetime.utcnow()
            
            cur.execute(
                """
                INSERT INTO users (id, name, email, hashed_password, subscription_plan, subscription_status, quota_used, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, "admin", "admin@gmail.com", hashed_pwd, "enterprise", "active", 0, now, now)
            )
            conn.commit()
            print("Admin user seeded successfully!")
            print("Email: admin@gmail.com")
            print("Name: admin")
            print("Password: admin")

        cur.close()
        conn.close()
    except Exception as e:
        print("Fatal error during seeding:", e)

if __name__ == "__main__":
    repair_and_seed()
