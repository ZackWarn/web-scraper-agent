"""
Setup script for Agent environment
Creates virtual environment and installs dependencies
"""

import subprocess
import sys
from pathlib import Path


def run_command(cmd, shell=True):
    """Run a command and print output"""
    print(f"\n>>> {cmd}")
    result = subprocess.run(cmd, shell=shell, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.returncode != 0 and result.stderr:
        print(f"Error: {result.stderr}")
        return False
    return True


def main():
    base_path = Path(__file__).parent

    print("=" * 60)
    print("AGENT ENVIRONMENT SETUP")
    print("=" * 60)

    # Step 1: Create virtual environment
    print("\n[1/3] Creating virtual environment 'agent_env'...")
    if not run_command(f"python -m venv {base_path / 'agent_env'}"):
        print("Failed to create virtual environment")
        return

    # Step 2: Upgrade pip
    print("\n[2/3] Upgrading pip...")
    pip_path = base_path / "agent_env" / "Scripts" / "pip.exe"
    if not run_command(f'"{pip_path}" install --upgrade pip'):
        print("Failed to upgrade pip")
        return

    # Step 3: Install requirements
    print("\n[3/3] Installing dependencies...")
    req_path = base_path / "requirements.txt"
    if not run_command(f'"{pip_path}" install -r "{req_path}"'):
        print("Failed to install requirements")
        return

    print("\n" + "=" * 60)
    print("SETUP COMPLETE!")
    print("=" * 60)
    print("\nTo activate the environment:")
    print(f"  .\\agent_env\\Scripts\\Activate.ps1")
    print("\nTo run the agent:")
    print("  python agent_batch.py 10 4")
    print("=" * 60)


if __name__ == "__main__":
    main()
