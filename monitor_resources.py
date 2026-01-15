"""
Monitor CPU and RAM usage for a process
Logs metrics to CSV for later analysis
"""
import psutil
import csv
import time
import sys
from datetime import datetime
from pathlib import Path

def find_process(search_term: str):
    """Find process by name"""
    for proc in psutil.process_iter(['pid', 'name']):
        if search_term.lower() in proc.info['name'].lower():
            return proc
    return None

def monitor_process(process_name: str, duration: int = 1200):
    """Monitor process CPU and memory usage"""
    
    print(f"\n🔍 Searching for process: {process_name}")
    proc = find_process(process_name)
    
    if not proc:
        print(f"❌ Process '{process_name}' not found")
        print("\nAvailable processes:")
        for p in psutil.process_iter(['pid', 'name']):
            if 'python' in p.name.lower():
                print(f"  - {p.name} (PID: {p.pid})")
        sys.exit(1)
    
    print(f"✅ Found: {proc.name} (PID: {proc.pid})")
    print(f"⏱️  Monitoring for {duration}s (max)\n")
    print("-" * 80)
    print(f"{'Timestamp':<20} {'CPU %':<10} {'Memory (MB)':<15} {'Memory %':<10}")
    print("-" * 80)
    
    # CSV output
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_file = f"resource_usage_{timestamp}.csv"
    
    metrics = []
    start_time = time.time()
    peak_cpu = 0
    peak_mem = 0
    
    try:
        while time.time() - start_time < duration:
            try:
                cpu_percent = proc.cpu_percent(interval=0.1)
                mem_info = proc.memory_info()
                mem_mb = mem_info.rss / 1024 / 1024
                mem_percent = proc.memory_percent()
                
                timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                print(f"{timestamp_str:<20} {cpu_percent:<10.2f} {mem_mb:<15.2f} {mem_percent:<10.2f}")
                
                metrics.append({
                    'timestamp': timestamp_str,
                    'cpu_percent': round(cpu_percent, 2),
                    'memory_mb': round(mem_mb, 2),
                    'memory_percent': round(mem_percent, 2),
                })
                
                peak_cpu = max(peak_cpu, cpu_percent)
                peak_mem = max(peak_mem, mem_mb)
                
                time.sleep(1)
                
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                print(f"\n⚠️  Process terminated or access denied")
                break
    
    except KeyboardInterrupt:
        print(f"\n\n⏹️  Monitoring stopped by user")
    
    # Write CSV
    if metrics:
        with open(csv_file, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['timestamp', 'cpu_percent', 'memory_mb', 'memory_percent'])
            writer.writeheader()
            writer.writerows(metrics)
        
        print("\n" + "=" * 80)
        print(f"📊 RESOURCE USAGE SUMMARY")
        print("=" * 80)
        print(f"Duration: {len(metrics)} seconds ({len(metrics)/60:.1f} minutes)")
        print(f"Peak CPU: {peak_cpu:.2f}%")
        print(f"Peak Memory: {peak_mem:.2f} MB")
        
        if metrics:
            avg_cpu = sum(m['cpu_percent'] for m in metrics) / len(metrics)
            avg_mem = sum(m['memory_mb'] for m in metrics) / len(metrics)
            print(f"Avg CPU: {avg_cpu:.2f}%")
            print(f"Avg Memory: {avg_mem:.2f} MB")
        
        print(f"\n💾 Data saved to: {csv_file}")
        print("=" * 80)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python monitor_resources.py <process_name> [duration_seconds]")
        print("\nExamples:")
        print("  python monitor_resources.py python")
        print("  python monitor_resources.py python 300")
        print("  python monitor_resources.py node")
        sys.exit(1)
    
    process_name = sys.argv[1]
    duration = int(sys.argv[2]) if len(sys.argv) > 2 else 1200
    
    monitor_process(process_name, duration)
