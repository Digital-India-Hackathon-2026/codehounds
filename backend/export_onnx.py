import os
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model_dir = r"E:\minilm"
onnx_path = os.path.join(model_dir, "model_int8.onnx")

try:
    print("Loading tokenizer and model...")
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    model.eval()

    text = "dummy text for onnx export"
    inputs = tokenizer(
        text, 
        return_tensors="pt", 
        padding="max_length", 
        truncation=True, 
        max_length=128
    )

    input_names = ["input_ids", "attention_mask"]
    output_names = ["logits"]

    print("Exporting model to ONNX...")
    torch.onnx.export(
        model,
        (inputs["input_ids"], inputs["attention_mask"]),
        onnx_path,
        input_names=input_names,
        output_names=output_names,
        dynamic_axes={
            "input_ids": {0: "batch_size"},
            "attention_mask": {0: "batch_size"},
            "logits": {0: "batch_size"}
        },
        opset_version=14
    )
    print("SUCCESS: ONNX model exported successfully to:", onnx_path)
except Exception as e:
    import traceback
    traceback.print_exc()
