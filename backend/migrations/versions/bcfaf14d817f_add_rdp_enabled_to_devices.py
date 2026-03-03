"""Add rdp_enabled to devices

Revision ID: bcfaf14d817f
Revises: e425cb84fb75
Create Date: 2026-02-28 09:51:41.040614

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bcfaf14d817f'
down_revision: Union[str, Sequence[str], None] = 'e425cb84fb75'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('devices', sa.Column('rdp_enabled', sa.Boolean(), server_default='0', nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('devices', 'rdp_enabled')
