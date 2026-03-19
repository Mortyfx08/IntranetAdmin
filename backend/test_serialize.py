import asyncio
from backend.database import async_session
from backend import models, schemas
from sqlalchemy import select

async def main():
    async with async_session() as session:
        res = await session.execute(select(models.Device).filter(models.Device.hostname == 'DESKTOP-FHKL098'))
        dev = res.scalar_one_or_none()
        if dev:
            print('DB has_agent:', dev.has_agent)
            schema = schemas.DeviceSchema.from_orm(dev)
            print('Schema dict:', schema.dict())

if __name__ == "__main__":
    asyncio.run(main())
