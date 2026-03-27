"""
S3 helpers for MindLift: upload bytes and generate presigned download URLs.

boto3 uses the standard AWS credential chain (env vars, instance profile,
Secrets Manager via the SDK — whichever is configured for the environment).
"""
import boto3
from botocore.exceptions import ClientError

from app.config import settings


def _client():
    return boto3.client("s3", region_name=settings.aws_region)


def upload_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    """Upload raw bytes to S3 at the given key."""
    _client().put_object(
        Bucket=settings.aws_s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
        ServerSideEncryption="AES256",
    )


def presigned_download_url(key: str, expires_in: int = 900) -> str:
    """
    Return a presigned GET URL for the given S3 key.
    Default expiry matches the spec: 15 minutes (900 seconds).
    Raises ClientError on failure.
    """
    url: str = _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.aws_s3_bucket, "Key": key},
        ExpiresIn=expires_in,
    )
    return url
