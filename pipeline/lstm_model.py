"""The LSTM used in notebook 05, shared with the final training script and the nightly job."""
import numpy as np
import torch
import torch.nn as nn

L = 40          # days of history the LSTM reads
HIDDEN = 32     # size of its memory


class Net(nn.Module):
    def __init__(self, n_clues):
        super().__init__()
        self.rnn = nn.LSTM(n_clues, HIDDEN, batch_first=True)
        self.out = nn.Linear(HIDDEN, 1)

    def forward(self, x):                              # x: (batch, 40 days, clues)
        memory_per_day, _ = self.rnn(x)
        return self.out(memory_per_day[:, -1]).squeeze(-1)


def get_device():
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


def story_batch(X, y, idx, device):
    """Rows i-39 ... i for each index i (X must hold each stock's days in order, one stock after another)."""
    offsets = torch.arange(-L + 1, 1, device=device)
    idx = torch.as_tensor(idx, device=device)
    return X[idx[:, None] + offsets], (y[idx] if y is not None else None)


def predict(net, X, idx, device, batch=8192):
    net.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(idx), batch):
            xb, _ = story_batch(X, None, idx[i:i + batch], device)
            out.append(net(xb).cpu().numpy())
    return np.concatenate(out) if out else np.array([])
