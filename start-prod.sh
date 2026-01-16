#!/bin/bash
# Define color variables
GREEN="\033[32;1m"
ORANGE="\033[33;1m"
RED="\033[31m"
RESET_COLOR="\033[0m" # Resets color to default

echo -e "${GREEN}…Starting PROD Servers…${RESET_COLOR}"

# Check if backend (3010) is listening
if lsof -PiTCP -sTCP:LISTEN -n | grep ':3010 ' >/dev/null; then
    echo -e "${ORANGE}[WARN]  Backend server is already running${RESET_COLOR}"
else
    echo "… Starting backend server…"
    cd backend
    NODE_ENV=production npm start &
    cd ..
    sleep 3
fi

# Check if frontend is running
if pgrep -f "vite" > /dev/null; then
    echo -e "${ORANGE}[WARN]  Frontend server is already running${RESET_COLOR}"
else
    echo "… Starting frontend server…"
    #NODE_ENV=production npm run build -- --mode production
#    NODE_ENV=production npm run build
    NODE_ENV=production npm run dev &
    sleep 3
fi

echo ""
echo -e "${GREEN}✔ Servers started up...${RESET_COLOR}"
echo ""
echo "The application will be available at:"
echo "- Frontend: http://localhost:4173"
echo "- Backend: http://localhost:3010"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for user to stop
wait 