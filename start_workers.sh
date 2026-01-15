#!/bin/bash
# Start multiple Redis workers for parallel domain processing
# Usage: ./start_workers.sh [number_of_workers]

WORKER_COUNT=${1:-5}

echo "Starting $WORKER_COUNT Redis workers..."
echo "Press Ctrl+C to stop all workers"
echo ""

# Array to store process IDs
pids=()

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping all workers..."
    for pid in "${pids[@]}"; do
        kill $pid 2>/dev/null
    done
    echo "✓ All workers stopped."
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup SIGINT SIGTERM

# Start workers
for i in $(seq 1 $WORKER_COUNT); do
    worker_id="worker-$i"
    echo "[$i/$WORKER_COUNT] Starting $worker_id..."
    python redis_worker.py $worker_id &
    pids+=($!)
    sleep 0.2
done

echo ""
echo "✓ All $WORKER_COUNT workers started!"
echo "  PIDs: ${pids[@]}"
echo ""
echo "Monitoring workers (Ctrl+C to stop)..."
echo "========================================"
echo ""

# Wait for all background processes
wait
