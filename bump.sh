#!/bin/sh
# Stamp the version (date.time, Kyiv) into the app and the bot before a commit: ./bump.sh
V=$(TZ=Europe/Kiev date +%d.%m.%H%M)
sed -i "s/^const APP_VER='[^']*';/const APP_VER='$V';/" app.html
sed -i "s/^const BOT_VER = '[^']*';/const BOT_VER = '$V';/" bot/farm_reminder_bot.gs
cp app.html v2/index.html
echo "$V"
