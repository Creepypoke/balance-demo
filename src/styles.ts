export const styles = `
:host{display:block;contain:content;color:#24342e;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light}
*{box-sizing:border-box}button{font:inherit}button:focus-visible,.scene:focus-visible{outline:3px solid #567c66;outline-offset:4px}
.game{background:var(--background,#f6f8f3);border:1px solid #dce4d8;border-radius:24px;overflow:hidden}
.top{display:flex;justify-content:space-between;gap:12px;padding:22px 24px 0;font-size:11px;text-transform:uppercase;letter-spacing:.13em;color:#6d7d70}
.count{font-variant-numeric:tabular-nums;white-space:nowrap;flex-shrink:0}.scene{position:relative;height:clamp(300px,55vw,400px);overflow:hidden;touch-action:pan-y;user-select:none;cursor:grab;background-image:radial-gradient(#d5ded0 1px,transparent 1px);background-size:24px 24px}
.scene:active{cursor:grabbing}canvas{width:100%;height:100%;display:block;position:absolute;inset:0;pointer-events:none}
.grab-target{position:absolute;touch-action:none;cursor:grab}
.ground{position:absolute;left:24px;right:24px;bottom:41px;border-top:1px solid #b6c4b1}
.ground::after{content:'ЛИНИЯ РАВНОВЕСИЯ';position:absolute;top:28px;right:0;font-size:9px;letter-spacing:.16em;color:#86947e}
.label{position:absolute;left:0;top:0;font-size:12px;font-weight:550;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;pointer-events:none;transform-origin:center;color:#24342e}
.shadow{position:absolute;width:120px;height:12px;left:0;bottom:35px;border-radius:50%;background:radial-gradient(ellipse,#31493225,transparent 70%);pointer-events:none}
.bottom{padding:0 24px 24px}.status{min-height:48px;text-align:center;margin:0 0 14px;font-size:14px;font-weight:550}.hint{display:block;color:#7b897b;font-size:11px;font-weight:400;margin-top:4px}
.actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}button{border:0;border-radius:12px;cursor:pointer;padding:12px 22px;font-weight:600;transition:background .15s}
.throw{background:#243e30;color:#fff;min-width:158px}.throw:hover{background:#365741}.throw:disabled{opacity:.5;cursor:default}.motion{background:#e7edde;color:#40533c}.motion[aria-pressed=true]{background:#d2e9cf}
.note{text-align:center;margin:12px 0 0;font-size:10px;color:#84907d;min-height:15px}
@media(prefers-reduced-motion:reduce){button{transition:none}}
`;
