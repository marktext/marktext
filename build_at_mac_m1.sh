#!/bin/bash 

rm -rf dist build node_modules 
git pull origin 
yarn install 
echo "patch it..."
bash patch.sh 
yarn run build
