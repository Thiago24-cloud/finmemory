#!/usr/bin/env python3
"""
Gera model.onnx demo para o scanner de estoque FinMemory.

Contrato (igual ao YOLO-cls / MobileNet export):
  input:  images  float32 [1, 3, 320, 320]  NCHW normalizado ImageNet
  output: logits  float32 [1, N]

O grafo usa média RGB por canal → Gemm para simular classes.
Serve para validar o pipeline ONNX no browser antes do modelo treinado.

Uso:
  pip install onnx numpy
  python scripts/vision/export-demo-classifier-onnx.py

Saída:
  apps/retailer/public/models/stock-v1/model.onnx
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import numpy as np
    import onnx
    from onnx import TensorProto, helper, numpy_helper
except ImportError:
    print("Instale dependências: pip install onnx numpy")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "apps" / "retailer" / "public" / "models" / "stock-v1"
LABELS_PATH = OUT_DIR / "labels.json"
INPUT_SIZE = 320

CLASSES = [
    {"label": "arroz 5kg", "ean": "7891234567890"},
    {"label": "feijao preto 1kg", "ean": "7891234567891"},
    {"label": "oleo soja 900ml", "ean": "7891234567892"},
]


def build_model(num_classes: int, size: int) -> onnx.ModelProto:
    # Pesos heurísticos: canal R→arroz, G→feijão, B→óleo (demo visual)
    W = np.array(
        [
            [2.2, -0.4, -0.4],
            [-0.4, 2.2, -0.4],
            [-0.4, -0.4, 2.0],
        ],
        dtype=np.float32,
    )
    B = np.array([-0.3, -0.3, -0.3], dtype=np.float32)

    nodes = [
        helper.make_node(
            "AveragePool",
            inputs=["images"],
            outputs=["pooled"],
            kernel_shape=[size, size],
            strides=[1, 1],
        ),
        helper.make_node("Reshape", inputs=["pooled", "reshape_shape"], outputs=["vec"]),
        helper.make_node("Gemm", inputs=["vec", "W", "B"], outputs=["logits"]),
    ]

    initializers = [
        numpy_helper.from_array(np.array([1, 3], dtype=np.int64), name="reshape_shape"),
        numpy_helper.from_array(W, name="W"),
        numpy_helper.from_array(B, name="B"),
    ]

    graph = helper.make_graph(
        nodes,
        "finmemory_stock_demo",
        inputs=[
            helper.make_tensor_value_info(
                "images", TensorProto.FLOAT, [1, 3, size, size]
            )
        ],
        outputs=[
            helper.make_tensor_value_info(
                "logits", TensorProto.FLOAT, [1, num_classes]
            )
        ],
        initializer=initializers,
    )

    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)])
    onnx.checker.check_model(model)
    return model


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if not LABELS_PATH.exists():
        meta = {
            "version": 1,
            "format": "classification",
            "inputSize": INPUT_SIZE,
            "inputName": "images",
            "outputName": "logits",
            "classes": CLASSES,
        }
        LABELS_PATH.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("labels.json criado")

    labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
    classes = labels.get("classes", CLASSES)
    size = int(labels.get("inputSize", INPUT_SIZE))
    num_classes = len(classes)

    model = build_model(num_classes, size)
    out_path = OUT_DIR / "model.onnx"
    onnx.save(model, out_path)
    print(f"model.onnx gerado ({out_path.stat().st_size // 1024} KB)")
    print(f"  classes: {num_classes}, input: [1,3,{size},{size}]")
    print("  Aponte a câmera para superfícies coloridas para testar o demo.")


if __name__ == "__main__":
    main()
