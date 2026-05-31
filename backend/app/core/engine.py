import os
import time
from typing import Dict, List, Tuple
from jinja2 import Template
from netmiko import ConnectHandler
from backend.app.core.templates import INIT_TEMPLATE, VERIFICATION_COMMANDS
from backend.app.core.parser import parse_verification

# Global variable to force mock mode
MOCK_DEVICES = os.getenv("MOCK_DEVICES", "true").lower() == "true"

def render_config(params: dict) -> str:
    """Render H3C configuration commands using Jinja2 template."""
    template = Template(INIT_TEMPLATE)
    return template.render(params=params)

def execute_config(device: dict, params: dict) -> Tuple[bool, str, str]:
    """
    Executes configuration on H3C device.
    Returns: (success_bool, execution_log, config_preview)
    """
    config_preview = render_config(params)
    commands = [line.strip() for line in config_preview.split("\n") if line.strip() and not line.strip().startswith("#")]

    log = []
    log.append(f"[*] Starting configuration session for {device['name']} ({device['host']})")
    
    is_mock = device.get("is_mock", False) or MOCK_DEVICES

    if is_mock:
        log.append(f"[MOCK] Connecting via SSH to {device['host']}:22 as {device['username']}...")
        time.sleep(0.5)
        log.append(f"[MOCK] Connected. Entering system-view...")
        for cmd in commands:
            log.append(f"[MOCK] Running command: {cmd}")
            # Simulate a brief delay per CLI command
            time.sleep(0.05)
        log.append(f"[MOCK] Saving configuration...")
        time.sleep(0.3)
        log.append(f"[MOCK] Configuration completed successfully.")
        return True, "\n".join(log), config_preview

    # Real connection logic via Netmiko
    try:
        net_device = {
            'device_type': device.get('device_type', 'hp_comware'),
            'host': device['host'],
            'username': device['username'],
            'password': device['password'],
            'port': device.get('port', 22),
            'secret': device.get('secret', ''),
        }
        log.append(f"Connecting to {device['host']}...")
        with ConnectHandler(**net_device) as net_conn:
            log.append("Connected. Entering system-view and sending configurations...")
            # Netmiko send_config_set handles configuration mode
            output = net_conn.send_config_set(commands)
            log.append(output)
            
            # Save configuration
            log.append("Saving configuration...")
            save_output = net_conn.send_command("save force")
            log.append(save_output)
            
        log.append("[*] Session closed. Configuration completed successfully.")
        return True, "\n".join(log), config_preview
    except Exception as e:
        log.append(f"[!] Error: {str(e)}")
        return False, "\n".join(log), config_preview

def execute_verification(device: dict, params: dict) -> Tuple[bool, Dict[str, dict], str]:
    """
    Executes validation commands on H3C device and parses results.
    Returns: (success_bool, results_dict, raw_logs)
    """
    log = []
    log.append(f"[*] Starting verification session for {device['name']} ({device['host']})")
    
    is_mock = device.get("is_mock", False) or MOCK_DEVICES
    results = {}
    
    if is_mock:
        log.append(f"[MOCK] Connecting via SSH for verification to {device['host']}...")
        time.sleep(0.3)
        
        # Populate simulated outputs
        mock_outputs = {
            "local_user": f"local-user {params.get('local_user', 'admin')} class manage\n password simple {params.get('local_password', '******')}\n service-type ssh telnet terminal\n authorization-attribute user-role level {params.get('privilege', 3)}",
            "ssh": "SSH server: Enabled\n SSH version: 2.0" if params.get("enable_ssh", True) else "SSH server: Disabled",
            "telnet": "Telnet server: Enabled" if params.get("enable_telnet", True) else "Telnet server: Disabled",
            "lldp": "LLDP status: Enabled\n Global LLDP status: Enabled" if params.get("enable_lldp", True) else "LLDP status: Disabled",
            "stp": "MSTP is enabled.\n Port Role State\n GE1/0/1 DESI FORWARDING" if params.get("enable_stp", True) else "STP is disabled",
            "ntp": f"Clock status: synchronized\n Clock source: {params.get('ntp_server', '10.10.10.10')}\n Timezone: {params.get('timezone', 'CET')}" if params.get("ntp_server") else "Clock status: unsynchronized"
        }
        
        for key, cmd_info in VERIFICATION_COMMANDS.items():
            cmd = cmd_info["command"]
            desc = cmd_info["desc"]
            log.append(f"[MOCK] Sending command: {cmd}")
            output = mock_outputs.get(key, "Command not found")
            log.append(f"[MOCK] Output:\n{output}\n---")
            
            passed = parse_verification(key, output, params)
            results[key] = {
                "desc": desc,
                "command": cmd,
                "output": output,
                "passed": passed
            }
            
        log.append("[MOCK] Verification process completed.")
        return True, results, "\n".join(log)

    # Real connection logic
    try:
        net_device = {
            'device_type': device.get('device_type', 'hp_comware'),
            'host': device['host'],
            'username': device['username'],
            'password': device['password'],
            'port': device.get('port', 22),
        }
        log.append(f"Connecting to {device['host']} for verification...")
        
        with ConnectHandler(**net_device) as net_conn:
            for key, cmd_info in VERIFICATION_COMMANDS.items():
                cmd = cmd_info["command"]
                desc = cmd_info["desc"]
                log.append(f"Sending command: {cmd}")
                
                # Send display command
                output = net_conn.send_command(cmd)
                log.append(f"Output:\n{output}\n---")
                
                passed = parse_verification(key, output, params)
                results[key] = {
                    "desc": desc,
                    "command": cmd,
                    "output": output,
                    "passed": passed
                }
                
        log.append("[*] Verification session completed.")
        return True, results, "\n".join(log)
    except Exception as e:
        log.append(f"[!] Error: {str(e)}")
        return False, {}, "\n".join(log)
