import re

def parse_local_user(output: str, username: str) -> bool:
    """Check if the specified local user is defined in configuration."""
    if not username:
        return True
    pattern = rf"local-user\s+{re.escape(username)}\b"
    return bool(re.search(pattern, output, re.IGNORECASE))

def parse_ssh_status(output: str) -> bool:
    """Check if SSH server is enabled.
    Example H3C output:
    SSH server: Enabled
    """
    return "enabled" in output.lower()

def parse_telnet_status(output: str) -> bool:
    """Check if Telnet server is enabled.
    Example H3C output:
    Telnet server: Enabled
    """
    return "enabled" in output.lower()

def parse_lldp_status(output: str) -> bool:
    """Check if LLDP global is enabled.
    Example H3C:
    LLDP status: Enabled
    Global LLDP status: Enabled
    """
    return "enabled" in output.lower()

def parse_stp_status(output: str) -> bool:
    """Check if STP is enabled.
    Example display stp brief output or status check:
    STP is enabled or displays port roles.
    """
    # If display stp brief returns ports, or stp status shows enabled
    return "enabled" in output.lower() or "mstp" in output.lower() or "rstp" in output.lower() or "pvst" in output.lower() or len(output.strip().split("\n")) > 1

def parse_ntp_status(output: str) -> bool:
    """Check if NTP is synchronized or active.
    Example H3C:
    Clock status: synchronized
    """
    return "synchronized" in output.lower() or "active" in output.lower() or "configured" in output.lower() or "ntp-service" in output.lower() or "server" in output.lower()

def parse_verification(key: str, output: str, params: dict = None) -> bool:
    """Dispatches parser depending on the verification check key."""
    output_lower = output.lower()
    if key == "local_user":
        username = params.get("local_user", "") if params else "admin"
        return parse_local_user(output, username)
    elif key == "ssh":
        return parse_ssh_status(output)
    elif key == "telnet":
        return parse_telnet_status(output)
    elif key == "lldp":
        return parse_lldp_status(output)
    elif key == "stp":
        return parse_stp_status(output)
    elif key == "ntp":
        return parse_ntp_status(output)
    return False
