import React from 'react';
import { Utensils, CircleCheck, Pencil, Plus } from 'lucide-react';

// "Seu almoço": o cartão herói do painel, sobre o wallpaper da scadahub.
// O anel enche durante a última hora antes do almoço e, durante o almoço, mostra o tempo que falta.
export default function MyLunchHero({ myLunch, ownSlot, isToday, onEditOwnSlot, onAddOwnSlot }) {
  if (!myLunch) return null;

  const eyebrow = myLunch.key === 'lunching'
    ? 'Almoçando agora'
    : myLunch.key === 'soon'
    ? 'Prepare-se'
    : isToday
    ? 'Seu almoço hoje'
    : 'Seu almoço neste dia';

  return (
    <section className={`lunch-hero is-${myLunch.key}`} aria-live="polite" aria-label="Seu almoço">
      <div className="lunch-hero-top">
        <span className="lunch-hero-eyebrow">
          <Utensils size={14} aria-hidden="true" />
          {eyebrow}
        </span>
        {myLunch.ring !== undefined && (
          <div
            className="lunch-hero-ring"
            style={{ '--ring': myLunch.ring }}
            role="img"
            aria-label={myLunch.key === 'done' ? 'Almoço concluído' : `Faltam ${myLunch.ringLabel}`}
          >
            {myLunch.key === 'done' ? <CircleCheck size={22} /> : <span>{myLunch.ringLabel}</span>}
          </div>
        )}
      </div>

      <div>
        <div className="lunch-hero-time">{myLunch.range || 'Sem horário'}</div>
        <p className="lunch-hero-status">{myLunch.status}</p>
      </div>

      <div className="lunch-hero-actions">
        {ownSlot ? (
          <button type="button" className="ui-btn light sm" onClick={() => onEditOwnSlot(ownSlot)}>
            <Pencil size={15} />
            Ajustar horário
          </button>
        ) : onAddOwnSlot ? (
          <button type="button" className="ui-btn light sm" onClick={onAddOwnSlot}>
            <Plus size={15} />
            Definir meu almoço
          </button>
        ) : null}
      </div>
    </section>
  );
}
