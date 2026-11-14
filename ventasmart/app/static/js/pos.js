(() => {
  const cart = [];
  const cartBody = document.getElementById('posCartBody');
  const itemsJsonInput = document.getElementById('itemsJsonInput');
  const subtotalEl = document.getElementById('posSubtotal');
  const descuentoEl = document.getElementById('posDescuento');
  const impuestosEl = document.getElementById('posImpuestos');
  const totalEl = document.getElementById('posTotal');
  const descInput = document.getElementById('descuentoPorcentaje');
  const taxCheck = document.getElementById('aplicarImpuesto');
  const taxInput = document.getElementById('impuestoPorcentaje');
  const searchInput = document.getElementById('posSearchProd');

  if (!cartBody) return;

  function renderCart() {
    cartBody.innerHTML = '';
    let subtotal = 0;

    cart.forEach((item, index) => {
      const lineTotal = item.precio * item.cantidad;
      subtotal += lineTotal;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.nombre}</strong><br><small class="text-muted">${item.codigo}</small></td>
        <td class="text-end tabular-nums">${formatCOP(item.precio)}</td>
        <td style="width:110px;">
          <input type="number" min="1" max="${item.stock}" value="${item.cantidad}" class="form-control form-control-sm text-end pos-qty" data-idx="${index}">
        </td>
        <td class="text-end tabular-nums fw-semibold">${formatCOP(lineTotal)}</td>
        <td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger pos-del" data-idx="${index}">&times;</button></td>
      `;
      cartBody.appendChild(tr);
    });

    const descPct = Math.max(0, Number(descInput?.value || 0));
    const descMonto = Math.round(subtotal * (descPct / 100));
    const base = Math.max(0, subtotal - descMonto);
    const taxPct = taxCheck?.checked ? Math.max(0, Number(taxInput?.value || 0)) : 0;
    const impMonto = Math.round(base * (taxPct / 100));
    const total = base + impMonto;

    if (subtotalEl) subtotalEl.textContent = formatCOP(subtotal);
    if (descuentoEl) descuentoEl.textContent = `-${formatCOP(descMonto)}`;
    if (impuestosEl) impuestosEl.textContent = formatCOP(impMonto);
    if (totalEl) totalEl.textContent = formatCOP(total);

    itemsJsonInput.value = JSON.stringify(
      cart.map((c) => ({ producto_id: c.id, cantidad: c.cantidad }))
    );
  }

  document.querySelectorAll('.pos-add-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const stock = Number(btn.dataset.stock);
      if (stock <= 0) return;

      const existing = cart.find((c) => c.id === id);
      if (existing) {
        if (existing.cantidad + 1 > stock) {
          alert('No hay existencias suficientes');
          return;
        }
        existing.cantidad += 1;
      } else {
        cart.push({
          id,
          codigo: btn.dataset.codigo,
          nombre: btn.dataset.nombre,
          precio: Number(btn.dataset.precio),
          stock,
          cantidad: 1,
        });
      }
      renderCart();
    });
  });

  cartBody.addEventListener('change', (e) => {
    if (e.target.classList.contains('pos-qty')) {
      const idx = Number(e.target.dataset.idx);
      const val = Math.max(1, Math.min(Number(e.target.value), cart[idx].stock));
      cart[idx].cantidad = val;
      renderCart();
    }
  });

  cartBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('pos-del')) {
      const idx = Number(e.target.dataset.idx);
      cart.splice(idx, 1);
      renderCart();
    }
  });

  [descInput, taxCheck, taxInput].forEach((el) => {
    el?.addEventListener('input', renderCart);
    el?.addEventListener('change', renderCart);
  });

  searchInput?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.pos-prod-item').forEach((card) => {
      const txt = card.dataset.search || '';
      card.style.display = txt.includes(q) ? '' : 'none';
    });
  });
})();
