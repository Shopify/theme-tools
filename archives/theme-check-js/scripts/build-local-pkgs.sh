# This script is expected to be used in conjunction with theme-check-js/scripts/setup-dev.sh
# Once all the yarn links have been set up, this script will update the local built package contents
# to reflect your latest local changes.

# This script assumes that the following repos are present local to this repo:
#   - theme-check-js
#   - liquid-language-server

echo "Building local packages..."

yarn build

cd ../liquid-language-server
yarn build

echo "Done building local packages!"