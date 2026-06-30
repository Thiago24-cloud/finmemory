#!/usr/bin/env node
/**
 * Gera model.onnx demo (sem Python) — mesmo contrato do export-demo-classifier-onnx.py
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { onnx } = require('onnx-proto');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'apps/retailer/public/models/stock-v1');
const LABELS_PATH = path.join(OUT_DIR, 'labels.json');
const INPUT_SIZE = 320;

const DEFAULT_CLASSES = [
  { label: 'arroz 5kg', ean: '7891234567890' },
  { label: 'feijao preto 1kg', ean: '7891234567891' },
  { label: 'oleo soja 900ml', ean: '7891234567892' },
];

function tensor(name, floats, dims) {
  return onnx.TensorProto.create({
    name,
    dims,
    dataType: onnx.TensorProto.DataType.FLOAT,
    floatData: Array.from(floats),
  });
}

function int64Tensor(name, ints) {
  return onnx.TensorProto.create({
    name,
    dims: [ints.length],
    dataType: onnx.TensorProto.DataType.INT64,
    int64Data: ints,
  });
}

function valueInfo(name, elemType, shape) {
  return onnx.ValueInfoProto.create({
    name,
    type: onnx.TypeProto.create({
      tensorType: onnx.TypeProto.Tensor.create({
        elemType,
        shape: onnx.TensorShapeProto.create({
          dim: shape.map((d) =>
            typeof d === 'string'
              ? onnx.TensorShapeProto.Dimension.create({ dimParam: d })
              : onnx.TensorShapeProto.Dimension.create({ dimValue: d })
          ),
        }),
      }),
    }),
  });
}

function intAttr(name, ints) {
  return onnx.AttributeProto.create({
    name,
    type: onnx.AttributeProto.AttributeType.INTS,
    ints,
  });
}

function buildModel(numClasses, size) {
  const W = new Float32Array([
    2.2, -0.4, -0.4,
    -0.4, 2.2, -0.4,
    -0.4, -0.4, 2.0,
  ]);
  const B = new Float32Array([-0.3, -0.3, -0.3]);

  const graph = onnx.GraphProto.create({
    name: 'finmemory_stock_demo',
    input: [valueInfo('images', onnx.TensorProto.DataType.FLOAT, [1, 3, size, size])],
    output: [valueInfo('logits', onnx.TensorProto.DataType.FLOAT, [1, numClasses])],
    initializer: [
      int64Tensor('reshape_shape', [1, 3]),
      tensor('W', W, [3, 3]),
      tensor('B', B, [3]),
    ],
    node: [
      onnx.NodeProto.create({
        opType: 'AveragePool',
        input: ['images'],
        output: ['pooled'],
        attribute: [intAttr('kernel_shape', [size, size]), intAttr('strides', [1, 1])],
      }),
      onnx.NodeProto.create({
        opType: 'Reshape',
        input: ['pooled', 'reshape_shape'],
        output: ['vec'],
      }),
      onnx.NodeProto.create({
        opType: 'Gemm',
        input: ['vec', 'W', 'B'],
        output: ['logits'],
      }),
    ],
  });

  return onnx.ModelProto.create({
    irVersion: onnx.Version.IR_VERSION,
    opsetImport: [onnx.OperatorSetIdProto.create({ domain: '', version: 13 })],
    graph,
  });
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (!fs.existsSync(LABELS_PATH)) {
    fs.writeFileSync(
      LABELS_PATH,
      `${JSON.stringify(
        {
          version: 1,
          format: 'classification',
          inputSize: INPUT_SIZE,
          inputName: 'images',
          outputName: 'logits',
          classes: DEFAULT_CLASSES,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    console.log('labels.json criado');
  }

  const labels = JSON.parse(fs.readFileSync(LABELS_PATH, 'utf8'));
  const classes = labels.classes || DEFAULT_CLASSES;
  const size = labels.inputSize || INPUT_SIZE;
  const model = buildModel(classes.length, size);
  const bytes = onnx.ModelProto.encode(model).finish();
  const outPath = path.join(OUT_DIR, 'model.onnx');
  fs.writeFileSync(outPath, Buffer.from(bytes));
  console.log(`model.onnx gerado (${Math.round(bytes.length / 1024)} KB)`);
  console.log(`  classes: ${classes.length}, input: [1,3,${size},${size}]`);
}

main();
