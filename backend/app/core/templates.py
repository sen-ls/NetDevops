# H3C Comware v7 CLI Templates

# Jinja2 template for device initialization
INIT_TEMPLATE = """#
system-view
{% if params.local_user %}
local-user {{ params.local_user }} class manage
 password simple {{ params.local_password }}
 service-type ssh telnet terminal
 authorization-attribute user-role level {{ params.privilege }}
 quit
{% endif %}
#
{% if params.enable_ssh %}
ssh server enable
# Configure VTY lines to accept SSH/Telnet and use AAA authentication
user-interface vty 0 63
 authentication-mode scheme
 protocol inbound all
 quit
{% endif %}
#
{% if params.enable_telnet %}
telnet server enable
{% endif %}
#
{% if params.enable_lldp %}
lldp global enable
{% endif %}
#
{% if params.enable_stp %}
stp global enable
{% endif %}
#
{% if params.ntp_server %}
clock timezone {{ params.timezone }} add {{ params.timezone_offset | default('08:00:00') }}
ntp-service unicast-server {{ params.ntp_server }}
{% endif %}
#
{% if params.vlan_id and params.vlan_ip %}
vlan {{ params.vlan_id }}
 description Management_VLAN
 quit
interface Vlan-interface{{ params.vlan_id }}
 ip address {{ params.vlan_ip }} {{ params.vlan_mask | default('255.255.255.0') }}
 quit
{% endif %}
#
{% if params.gateway %}
ip route-static 0.0.0.0 0.0.0.0 {{ params.gateway }}
{% endif %}
#
save force
#
"""

# Dict containing verification commands to run and check
VERIFICATION_COMMANDS = {
    "local_user": {
        "command": "display current-configuration | include local-user",
        "desc": "Check local user configuration"
    },
    "ssh": {
        "command": "display ssh server status",
        "desc": "Check SSH server status"
    },
    "telnet": {
        "command": "display telnet server status",
        "desc": "Check Telnet server status"
    },
    "lldp": {
        "command": "display lldp status",
        "desc": "Check LLDP status"
    },
    "stp": {
        "command": "display stp brief",
        "desc": "Check STP status"
    },
    "ntp": {
        "command": "display ntp-service status",
        "desc": "Check NTP service status"
    }
}
