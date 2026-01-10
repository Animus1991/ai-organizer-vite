"""
P1-2: Standardized Error Response Format

All API errors should return a consistent machine-readable format:
{
    "code": "error_code_string",
    "message": "Human-readable error message",
    "details": { ... }  // Optional additional context
}
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from pydantic import BaseModel
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse


class ErrorResponse(BaseModel):
    """Standard error response format for all API errors"""
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


def create_error_response(
    code: str,
    message: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    details: Optional[Dict[str, Any]] = None
) -> HTTPException:
    """
    Create a standardized HTTPException with ErrorResponse format.
    
    Args:
        code: Machine-readable error code (e.g., "not_found", "validation_error")
        message: Human-readable error message
        status_code: HTTP status code (default: 400)
        details: Optional additional context (e.g., validation errors, field names)
    
    Returns:
        HTTPException with standardized detail format
    """
    error_response = ErrorResponse(code=code, message=message, details=details)
    return HTTPException(
        status_code=status_code,
        detail=error_response.dict(exclude_none=True)
    )


def error_response_handler(request, exc: HTTPException) -> JSONResponse:
    """
    FastAPI exception handler to standardize all HTTPException responses.
    
    This handler converts any HTTPException to the standard ErrorResponse format.
    If the detail is already a dict with 'code' and 'message', it's used as-is.
    Otherwise, it's wrapped in the standard format.
    
    Args:
        request: FastAPI Request object (required by FastAPI signature)
        exc: HTTPException that was raised
    """
    # If detail is already a dict (from create_error_response), use it
    if isinstance(exc.detail, dict):
        if "code" in exc.detail and "message" in exc.detail:
            # Already in standard format
            return JSONResponse(
                status_code=exc.status_code,
                content=exc.detail
            )
        # Dict but not standard format - wrap it
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": _derive_error_code(exc.status_code),
                "message": exc.detail.get("detail", str(exc.detail)),
                "details": exc.detail
            }
        )
    
    # If detail is a string, wrap it
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": _derive_error_code(exc.status_code),
            "message": str(exc.detail)
        }
    )


def _derive_error_code(status_code: int) -> str:
    """Derive error code from HTTP status code"""
    code_map = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "validation_error",
        500: "internal_server_error",
        503: "service_unavailable",
    }
    return code_map.get(status_code, "error")


# Common error creators for convenience
def not_found(resource: str = "Resource", identifier: Optional[str] = None) -> HTTPException:
    """Create a 404 Not Found error"""
    message = f"{resource} not found"
    if identifier:
        message += f": {identifier}"
    return create_error_response(
        code="not_found",
        message=message,
        status_code=status.HTTP_404_NOT_FOUND,
        details={"resource": resource, "identifier": identifier} if identifier else None
    )


def unauthorized(message: str = "Unauthorized", details: Optional[Dict[str, Any]] = None) -> HTTPException:
    """Create a 401 Unauthorized error"""
    return create_error_response(
        code="unauthorized",
        message=message,
        status_code=status.HTTP_401_UNAUTHORIZED,
        details=details
    )


def forbidden(message: str = "Access forbidden", details: Optional[Dict[str, Any]] = None) -> HTTPException:
    """Create a 403 Forbidden error"""
    return create_error_response(
        code="forbidden",
        message=message,
        status_code=status.HTTP_403_FORBIDDEN,
        details=details
    )


def conflict(message: str = "Resource conflict", details: Optional[Dict[str, Any]] = None) -> HTTPException:
    """Create a 409 Conflict error"""
    return create_error_response(
        code="conflict",
        message=message,
        status_code=status.HTTP_409_CONFLICT,
        details=details
    )


def validation_error(message: str = "Validation error", details: Optional[Dict[str, Any]] = None) -> HTTPException:
    """Create a 422 Unprocessable Entity error"""
    return create_error_response(
        code="validation_error",
        message=message,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        details=details
    )


def bad_request(message: str = "Bad request", details: Optional[Dict[str, Any]] = None) -> HTTPException:
    """Create a 400 Bad Request error"""
    return create_error_response(
        code="bad_request",
        message=message,
        status_code=status.HTTP_400_BAD_REQUEST,
        details=details
    )


def internal_server_error(message: str = "Internal server error", details: Optional[Dict[str, Any]] = None) -> HTTPException:
    """Create a 500 Internal Server Error"""
    return create_error_response(
        code="internal_server_error",
        message=message,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        details=details
    )
