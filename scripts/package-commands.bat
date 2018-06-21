@echo off
IF "%1"=="build" (
npm run clean && ^
npm run iconfont && ^
mkdir dist && ^
cmd /C "set NODE_ENV='production' && webpack"
Exit /B 0
)
IF "%1"=="prod" (
if exist prod rd /s /q prod

npm run build && ^
npm run themesconfig && ^
mkdir prod\translations && ^
xcopy dist\* prod\dist /s /i && ^
copy index.html prod && ^
xcopy assets\* prod\assets /s /i && ^
copy themes.json prod && ^
copy translations\data.* prod\translations
if exist config.prod.json (
	copy config.prod.json prod\config.json
) else (
    copy config.json prod\config.json
)
Exit /B 0
)
IF "%1"=="analyze" (
cmd /C "set NODE_ENV='production' && webpack --json | webpack-bundle-size-analyzer"
Exit /B 0
)
IF "%1"=="release" (
echo "This command is not available on Windows"
Exit /B 0
)
echo "Missing or unrecognized command"
Exit /B 1
