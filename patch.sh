#!/bin/bash

FILE="./node_modules/keytar/binding.gyp"

if [ ! -f "$FILE" ]; then
    echo "错误: 文件不存在"
    exit 1
fi

# 检查是否已添加，防止重复
if grep -q "openssl_fips" "$FILE"; then
    echo "补丁已存在，跳过。"
    exit 0
fi

# 使用 awk 在第 2 行插入内容
# NR < 2 表示第1行正常打印
# NR == 2 时，先打印新内容，再打印原第2行
awk 'NR==2 {print "  \"variables\": {\n    \"openssl_fips\": \"\"\n  },"} 1' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"

echo "成功在第 2 行开始处插入内容。"
