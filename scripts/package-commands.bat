@echo off

IF "%1"=="release" (
echo "This command is not available on Windows"
Exit /B 0
)
echo "Missing or unrecognized command"
Exit /B 1
