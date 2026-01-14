from typing import List, Optional
from pydantic import BaseModel, HttpUrl, Field


class EnqueueRequest(BaseModel):
    domain: str = Field(..., description="Company domain to scrape")
    snapshot_path: Optional[str] = Field(
        None, description="Optional local snapshot path if already downloaded"
    )


class StatusResponse(BaseModel):
    domain: str
    status: str
    has_company: bool


class CompanyProfile(BaseModel):
    domain: str
    name: Optional[str]
    short_description: Optional[str]
    long_description: Optional[str]
    industry: Optional[str]
    sub_industry: Optional[str]
    products_services: List[str] = []
    locations: List[str] = []
    key_people: List[dict] = []
    contacts: List[dict] = []
    tech_stack: List[str] = []
    logo_url: Optional[HttpUrl] = None


class CompanyResponse(BaseModel):
    domain: str
    name: Optional[str]
    json_data: dict


class GraphEdge(BaseModel):
    source: str
    target: str
    kind: str


class GraphResponse(BaseModel):
    domain: str
    edges: List[GraphEdge]
