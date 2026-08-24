@echo off
git init
git add .
git commit -m "Backup: Fixed org chart connector lines, dynamic layout reflow, and 2-column bounds"
git tag -a org-chart-stable-v1 -m "Org Chart Stable Release v1"
echo Git backup and tag created successfully!
pause
