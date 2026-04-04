#!/bin/bash 

rm -rf dist build node_modules 
git pull origin main 
yarn install 
bash patch.sh 
yarn run build
