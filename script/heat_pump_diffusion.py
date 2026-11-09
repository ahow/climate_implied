"""US heat-pump shipment diagnostic under docs/Heat_Pump_Diffusion_Protocol.md."""
import json, math, sys

def fit_linear(xs, ys):
    n = len(xs); mx = sum(xs) / n; my = sum(ys) / n
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    return my - b * mx, b

def evaluate(series, train, test):
    xs = [y for y in train]; ys = [series[y] for y in train]
    a, b = fit_linear(xs, ys)
    la, lb = fit_linear(xs, [math.log(v) for v in ys])
    forecasts = {
        "persistence": {y: ys[-1] for y in test},
        "linear": {y: a + b * y for y in test},
        "log_linear": {y: math.exp(la + lb * y) for y in test},
    }
    mape = {k: sum(abs(f[y] - series[y]) / series[y] for y in test) / len(test) for k, f in forecasts.items()}
    return {"mape": mape, "best": min(mape, key=mape.get), "log_linear_growth": math.exp(lb) - 1}

def main(path):
    series = {int(k): v for k, v in json.load(open(path))["units"].items()}
    test = list(range(2019, 2026))
    out = {"primary_2011_2018": evaluate(series, list(range(2011, 2019)), test),
           "sensitivity_2006_2018": evaluate(series, list(range(2006, 2019)), test)}
    print(json.dumps(out, indent=1))

if __name__ == "__main__":
    main(sys.argv[1])
