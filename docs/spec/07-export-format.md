# 匯出格式 (Export Format)

為了確保匯出後能被 Obsidian 讀取，必須嚴格遵守以下格式：

## 匯出檔案結構 (ZIP)

```
Project_Name.zip
├── assets/             # (Optional) 存放圖片
├── card-20231027.md    # 從卡片內容生成的筆記
├── card-20231028.md
└── dashboard.canvas    # 描述佈局的 JSON
```

## Obsidian Canvas JSON 規範 (簡化版)

```json
{
  "nodes": [
    {
      "id": "unique-id-1",
      "type": "file",
      "file": "card-20231027.md",
      "x": 0,
      "y": 0,
      "width": 400,
      "height": 600
    },
    {
      "id": "unique-id-2",
      "type": "text",
      "text": "# 直接寫在白板上的文字",
      "x": 500,
      "y": 0,
      "width": 300,
      "height": 200
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "fromNode": "unique-id-1",
      "fromSide": "right",
      "toNode": "unique-id-2",
      "toSide": "left"
    }
  ]
}
```
