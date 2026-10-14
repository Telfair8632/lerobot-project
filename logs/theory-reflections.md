# Theory Reflections — Study Notes Behind the Project

Notes taken while studying **UC Berkeley CS285 (Imitation Learning)**, **Stanford CS231N (Lectures 3 & 4)**, and **Hung-yi Lee's Machine Learning course**, connected back to what happened in this project.

---

## Part I — CS285: Why the Arm Repeated the Same Motion and Failed to Generalize

The core reason: **the observations at inference time were inconsistent with the observations seen during training.**

A simple analogy. Suppose you are teaching an AI to drive. You collect 100 hours of normal driving data, and the AI learns how to handle all kinds of road conditions. Then you put it on a real road…

At first, everything is fine. Suddenly the steering drifts a little — maybe wind, maybe an uneven surface, maybe just a small neural-network error.

Here is the problem: the AI has **never seen** this "slightly drifted" state. In the training data, the expert never leaves the lane, so the AI has no idea what to do in that state. It takes some random action, drifts further into an even less familiar state, takes an even stranger action…

This is **compounding errors**, also known as **distribution shift**. In plain words: it does not know what to do when facing something it has never seen — poor generalization.

### The math behind it

At every step the per-step error probability $\varepsilon$ is small, but along a trajectory of length $T$:

- probability the first step errs: $\varepsilon$
- probability at least one of the first two steps errs: $1-(1-\varepsilon)^2$
- probability at least one of the first $T$ steps errs: $1-(1-\varepsilon)^T$

This looks like a harmless linear accumulation — but the moment an error happens, the agent enters a state **never covered by training data**, after which the error probability explodes. More careful analysis shows that the expected total cost of behavior cloning (the gap to the expert) grows **quadratically** with trajectory length: $J(\pi_{BC}) \sim \varepsilon T^2$.

In other words: this is the general train/test distribution mismatch problem of machine learning, amplified — because in sequential decision-making, **the current action changes the future state**.

### Four standard remedies — and how they map to my constraints

**Method 1: collect more data.** Simple: the more you have seen, the more you can handle. But:
- expert data is expensive (a human demonstrator's time). For me, every additional hour of teleoperation recording is an hour out of my schedule, and meaningfully attacking the problem this way would need several times my current dataset.
- covering all possible states is a combinatorial explosion.
- some error states an expert would simply never enter. I would never deliberately record episodes of the arm flailing around — there are too many such possibilities to cover.

**Method 2: data augmentation.** Artificially perturb the training data to simulate "off-track" situations: add noise to observations, jitter some state dimensions, or generate boundary cases in a simulator. Works well in practice, but designing the right augmentations takes domain knowledge — this is something I may try next.

**Method 3: a stronger model & more data.** In theory, if the policy could perfectly copy the expert, the shifted distribution would vanish. But in my understanding that is exactly where overfitting creeps in.

**Method 4: multi-task learning.** Training across many related tasks improves generalization — the idea behind large language models pre-trained on massive diverse corpora. But it needs data and compute far beyond my setup.

### DAgger (Dataset Aggregation): letting the expert fill the gaps

All methods above try to make the training state distribution $p_{data}(s)$ cover the test-time distribution $p_{\pi}(s)$. DAgger takes the direct route: since the learned policy will wander into new states, **tell it what to do in exactly those states**.

1. Train a policy $\pi_1$ from the current dataset.
2. Run $\pi_1$ in the environment; collect the states it actually visits.
3. Ask the expert to label the correct action for those states.
4. Aggregate the new data and retrain.
5. Repeat steps 2–4.

The training distribution then converges toward the states the policy actually visits, defusing distribution shift.

**Why it works.** The key observation: after enough iterations, the training distribution converges to the visitation distribution of the final policy. The classic result: if $\varepsilon$ is the policy's average error rate under its training distribution and $T$ the horizon, DAgger's expected cost is $O(\varepsilon T)$ — **linear** in $T$, versus behavior cloning's $O(\varepsilon T^2)$. Going from quadratic to linear is a qualitative leap.

**DAgger's limitation**: it needs a real-time expert labeler for states the policy reaches — which for a physical robot arm means standing by with the leader arm while the follower wanders.

### Error bounds, stated more carefully

*Behavior cloning*: with per-step error rate $\varepsilon$ under the expert distribution and trajectory length $T$, once the agent drifts off the expert distribution its per-step error probability is much higher (assume 1). The expected number of mistakes grows ~$\varepsilon T^2$ — which explains why behavior cloning degrades badly on long-horizon tasks. My pick-and-place loop, with no termination signal, is exactly such a long-horizon degenerate case.

*DAgger*: after $N$ aggregation iterations with per-iteration error $\varepsilon_N$, the bound becomes $O(\varepsilon_N T)$ — for large $N$, essentially linear in $T$.

---

## Part II — CS231N (Lectures 3 & 4): Loss, Overfitting, and Regularization

For a large vision model (e.g. a CNN), image recognition faces a set of classic challenges.

**The loss function** measures how well the model fits the training data — lower is better. But a loss that is *too* low means the model has learned too much — including the **noise** in the dataset. In my own teleoperation recording, if I occasionally moved through an extra segment of trajectory that had nothing to do with the task, the model would still learn it in during training just to push the loss down. That is overfitting.

To prevent it, we add a penalty term to the loss:

$$L_{total} = L_{data} + \lambda R(w)$$

This is **regularization**. It raises the training loss but buys stronger generalization and better test performance. Between two models, we prefer the regularized one: the unregularized model has lower training loss but has learned far too much — textbook overfitting.

Common forms include L2 regularization $\lambda\|w\|_2^2$ (weight decay), L1 regularization $\lambda\|w\|_1$ (drives sparsity), and dropout.

### Regularization is not "big weights are bad" — it is "weights shouldn't be bigger than the data justifies"

If a feature is truly important, a regularized model will still assign it a large weight. The penalty only demands that a large weight pay for itself with sufficient evidence (a real drop in loss).

**Why are large weights inherently dangerous? Mathematical intuition: large weight = high sensitivity.**

Take the simplest linear model $y = w_1 x_1 + w_2 x_2$. If $w_1 = 100$, then a change of $0.01$ in $x_1$ moves the prediction by $1.0$ — the model is extremely sensitive to small input perturbations. Two consequences:

1. **Noise amplification.** Every training point is signal + noise, e.g. truth $y = 2x + \varepsilon,\ \varepsilon \sim \mathcal{N}(0,1)$, while an overfit fit like $y = 2x + 50x^2 - 30x^3 + \cdots$ fits the noise. Large weights usually come from the model contorting itself to pass through every noisy training point — better on the training set, disastrous on new data.
2. **High variance.** Fit the same underlying distribution with three different samples:
   - sample 1 → weights $[3.2, 0.1, 5.7]$
   - sample 2 → weights $[1.1, 8.3, 0.4]$ — completely different
   - sample 3 → weights $[6.5, 2.1, 9.2]$
   
   Without regularization the weights swing wildly across samples; large weights are a *symptom* of high variance, not the cause.

**A concrete example**: fit 5 points with a degree-10 polynomial $y = w_0 + w_1 x + \cdots + w_{10} x^{10}$. The fitted result: $w_0 = 0.1$ (small), $w_1 = 2.3$ (moderate), $w_3 = 450.0$ (huge!), $w_7 = -380.0$ (huge!). Those giant coefficients exist not because those features matter, but because the model exploits the violent oscillations of high-order terms to thread through every point exactly. Large weights come from overfitting, not from signal.

### The real mechanism: not prohibition, but pricing

Regularization is essentially a budget constraint. Read it as: *"You may have a large weight — but you must prove it is worth it."*

This connects directly to the arm project: my 51.7M-parameter ACT model trained on ~12.6k low-diversity frames had ample capacity to "pay" for memorizing fixed positions with a low loss — precisely the shortcut behavior observed at deployment. More diverse data and language grounding raise the price of shortcuts; regularization is one lever among several.

---

## Part III — Hung-yi Lee, Machine Learning: The Essence

The essence of machine learning is fitting a function — a function so complex that humans cannot discover or write it down explicitly.
