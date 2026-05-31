import os
import yaml
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.app.core.engine import execute_config, execute_verification

app = FastAPI(
    title="NetDevOps Automation Platform API",
    description="Backend API for H3C device automated deployment and verification.",
    version="1.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development ease, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INVENTORY_PATH = os.path.join(os.path.dirname(__file__), "inventory", "hosts.yaml")

# --- Pydantic Data Models ---

class DeviceSchema(BaseModel):
    host: str
    name: str
    device_type: str = "hp_comware"
    username: str
    password: str
    is_mock: bool = True

class InitParamsSchema(BaseModel):
    local_user: str = "sen"
    local_password: str = "MyPass123"
    privilege: int = 3
    enable_ssh: bool = True
    enable_telnet: bool = True
    enable_lldp: bool = True
    enable_stp: bool = True
    ntp_server: Optional[str] = "10.10.10.10"
    timezone: Optional[str] = "CET"
    timezone_offset: Optional[str] = "01:00:00"
    vlan_id: Optional[int] = None
    vlan_ip: Optional[str] = None
    vlan_mask: Optional[str] = "255.255.255.0"
    gateway: Optional[str] = None

class ActionRequestSchema(BaseModel):
    device_host: str
    params: InitParamsSchema

# --- Helper Functions ---

def load_inventory() -> List[dict]:
    if not os.path.exists(INVENTORY_PATH):
        # Ensure directory exists
        os.makedirs(os.path.dirname(INVENTORY_PATH), exist_ok=True)
        with open(INVENTORY_PATH, "w") as f:
            yaml.dump([], f)
        return []
    with open(INVENTORY_PATH, "r") as f:
        data = yaml.safe_load(f)
        return data if data is not None else []

def save_inventory(devices: List[dict]):
    os.makedirs(os.path.dirname(INVENTORY_PATH), exist_ok=True)
    with open(INVENTORY_PATH, "w") as f:
        yaml.safe_dump(devices, f, default_flow_style=False)

def get_device_by_host(host: str) -> dict:
    devices = load_inventory()
    for d in devices:
        if d["host"] == host:
            return d
    raise HTTPException(status_code=404, detail=f"Device with host {host} not found in inventory.")

# --- API Endpoints ---

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "mock_mode": os.getenv("MOCK_DEVICES", "true").lower() == "true"}

@app.get("/api/devices", response_model=List[DeviceSchema])
def get_devices():
    """Retrieve all devices in the inventory."""
    return load_inventory()

@app.post("/api/devices", response_model=DeviceSchema)
def add_device(device: DeviceSchema):
    """Add a new device to the YAML inventory."""
    devices = load_inventory()
    # Check for duplicates
    if any(d["host"] == device.host for d in devices):
        raise HTTPException(status_code=400, detail=f"Device with host {device.host} already exists.")
    
    devices.append(device.model_dump())
    save_inventory(devices)
    return device

@app.post("/api/run-init")
def run_init(payload: ActionRequestSchema):
    """Render and execute the base initialization commands on the device."""
    device = get_device_by_host(payload.device_host)
    params_dict = payload.params.model_dump()
    
    success, log, preview = execute_config(device, params_dict)
    
    return {
        "success": success,
        "device": device["name"],
        "log": log,
        "config_preview": preview
    }

@app.post("/api/run-verify")
def run_verify(payload: ActionRequestSchema):
    """Execute validation commands and return parsed PASS/FAIL outcomes."""
    device = get_device_by_host(payload.device_host)
    params_dict = payload.params.model_dump()
    
    success, results, raw_logs = execute_verification(device, params_dict)
    
    return {
        "success": success,
        "device": device["name"],
        "results": results,
        "raw_logs": raw_logs
    }

# Mount static files to serve the frontend single-page application
app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static"), html=True), name="static")
