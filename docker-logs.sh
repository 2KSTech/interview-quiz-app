#!/bin/bash
# Combined logs script for docker-compose
# Usage: ./docker-logs.sh [follow]

if [ "$1" == "follow" ] || [ "$1" == "-f" ]; then
    docker-compose logs -f
else
    docker-compose logs
fi

