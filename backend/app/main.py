from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import auth, interview, knowledge, meta, profile, resume, resume_gen


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="JobSeekHelper API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(resume.router, prefix="/api")
app.include_router(resume_gen.router, prefix="/api")
app.include_router(knowledge.router, prefix="/api")
app.include_router(meta.router, prefix="/api")
app.include_router(interview.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
