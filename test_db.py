import asyncio
import sys
import os

# Ensure we can import from backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import async_session
from backend import models
from sqlalchemy import select

async def test_db():
    print("Connecting to DB...", flush=True)
    try:
        async with async_session() as session:
            print("Session opened. Executing query...", flush=True)
            result = await session.execute(select(models.Device))
            devices = result.scalars().all()
            print(f"Query finished! Found {len(devices)} devices.", flush=True)
            for d in devices:
                print(f" - {d.id}: {d.hostname} ({d.ip_address})", flush=True)
    except Exception as e:
        print(f"Error: {e}", flush=True)

if __name__ == "__main__":
    asyncio.run(test_db())
