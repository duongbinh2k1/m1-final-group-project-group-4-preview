import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "main:socket_app",
        host=settings.server_host,
        port=settings.server_port,
        reload=False,
    )
