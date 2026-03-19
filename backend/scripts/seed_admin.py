#!/usr/bin/env python3
"""
scripts/seed_admin.py
─────────────────────
Creates the default admin account if it does not already exist.

Default credentials  (CHANGE AFTER FIRST LOGIN):
  username: admin
  password: CyberRans!Change123

Run after migrations:
    docker exec -it cyberrans_backend python scripts/seed_admin.py
"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from passlib.context import CryptContext
from app.config import settings
from app.models.models import Base, User

DEFAULT_USERNAME = "admin"
DEFAULT_EMAIL    = "admin@cyberrans.local"
DEFAULT_PASSWORD = "CyberRans!Change123"

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_admin() -> None:
    engine  = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with Session() as session:
        result = await session.execute(select(User).where(User.username == DEFAULT_USERNAME))
        existing = result.scalar_one_or_none()

        if existing:
            print(f"  ⏭  Admin account '{DEFAULT_USERNAME}' already exists — skipping.")
            if not existing.is_admin:
                existing.is_admin = True
                await session.commit()
                print("  ✅  Elevated existing account to admin.")
        else:
            admin = User(
                username        = DEFAULT_USERNAME,
                email           = DEFAULT_EMAIL,
                hashed_password = _pwd.hash(DEFAULT_PASSWORD),
                is_admin        = True,
                is_active       = True,
            )
            session.add(admin)
            await session.commit()
            print(f"""
  ✅  Default admin account created.

  ┌─────────────────────────────────────────┐
  │  Username : admin                       │
  │  Password : CyberRans!Change123         │
  │                                         │
  │  ⚠  CHANGE THIS PASSWORD AFTER LOGIN   │
  └─────────────────────────────────────────┘

  Login at: http://localhost:5173 → ⚙ Admin
""")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_admin())
