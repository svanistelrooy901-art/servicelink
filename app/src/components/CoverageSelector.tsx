import { t } from '../i18n';
import { Plus, Trash2, MapPin } from 'lucide-react';
import { useState } from 'react';
import { geography, stateById } from '../lib/geography';
import type { Coverage } from '../lib/types';
export function CoverageSelector({
  value,
  onChange,
}: {
  value: Coverage[];
  onChange: (v: Coverage[]) => void;
}) {
  const [state, setState] = useState('');
  const available = geography.filter((s) => !value.some((c) => c.stateId === s.id));
  return (
    <div className="coverage-editor">
      <p className="hint">
        {t('Choose where you provide your services. You can cover multiple states and districts.')}
      </p>
      {value.map((c, i) => {
        const s = stateById(c.stateId);
        if (!s) return null;
        const update = (patch: Partial<Coverage>) =>
          onChange(value.map((x, j) => (i === j ? { ...x, ...patch } : x)));
        return (
          <fieldset className="coverage-state" key={c.stateId}>
            <legend>
              <MapPin size={15} />
              {s.name}
            </legend>
            <button
              type="button"
              className="icon-btn remove-area"
              aria-label={t('Remove {name}', { name: s.name })}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} />
            </button>
            <label className="check-row">
              <input
                type="checkbox"
                checked={c.wholeState}
                onChange={(e) => update({ wholeState: e.target.checked, subdivisionIds: [] })}
              />{' '}
              {t('Entire state / territory')}
            </label>
            {!c.wholeState && (
              <div className="district-options">
                {s.subdivisions.map((d) => (
                  <label className="check-row" key={d.id}>
                    <input
                      type="checkbox"
                      checked={c.subdivisionIds.includes(d.id)}
                      onChange={(e) =>
                        update({
                          subdivisionIds: e.target.checked
                            ? [...c.subdivisionIds, d.id]
                            : c.subdivisionIds.filter((id) => id !== d.id),
                        })
                      }
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        );
      })}
      {available.length > 0 && (
        <div className="add-area">
          <label className="sr-only" htmlFor="add-state">
            {t('Add a state or federal territory')}
          </label>
          <select id="add-state" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">{t('Select state / federal territory')}</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary"
            disabled={!state}
            onClick={() => {
              onChange([...value, { stateId: state, wholeState: true, subdivisionIds: [] }]);
              setState('');
            }}
          >
            <Plus size={16} />
            {t('Add')}
          </button>
        </div>
      )}
      <p className="tiny">
        {t(
          'District choices use the shared DOSM geography list. Your home address is never needed here.',
        )}
      </p>
    </div>
  );
}
