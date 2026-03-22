"""
Account management endpoints.

POST /account/export    — enqueue data-export Celery job, return 202
DELETE /account         — soft-delete account, revoke tokens, enqueue deletion job, return 202
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_log
from app.database import get_db
from app.models.user import User
from app.services.auth import get_current_user
from app.worker.tasks import generate_export_zip, process_account_deletion

router = APIRouter(prefix="/account", tags=["account"])


@router.post("/export", status_code=status.HTTP_202_ACCEPTED)
async def request_export(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Enqueue a Celery task to generate a GDPR data-export ZIP for the user.
    Returns 202 Accepted immediately; the user will be notified when ready.
    """
    task = generate_export_zip.delay(str(current_user.id))
    await write_audit_log(
        db,
        actor_type="user",
        actor_id=current_user.id,
        action_key="account.export_requested",
        entity_type="user",
        entity_id=current_user.id,
        metadata={"task_id": task.id},
    )
    await db.flush()
    return {"message": "Export job enqueued.", "task_id": task.id}


@router.delete("", status_code=status.HTTP_202_ACCEPTED)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Initiate account deletion:
    1. Soft-delete the user record immediately (sets deleted_at, state=DELETED).
    2. Enqueue a Celery task to purge all user data after any required retention period.
    Returns 202 Accepted.
    """
    now = datetime.now(timezone.utc)
    current_user.deleted_at = now
    current_user.state = "DELETED"
    current_user.updated_at = now

    task = process_account_deletion.delay(str(current_user.id))

    await write_audit_log(
        db,
        actor_type="user",
        actor_id=current_user.id,
        action_key="account.deletion_requested",
        entity_type="user",
        entity_id=current_user.id,
        metadata={"task_id": task.id},
    )
    await db.flush()
    return {"message": "Account deletion scheduled.", "task_id": task.id}
