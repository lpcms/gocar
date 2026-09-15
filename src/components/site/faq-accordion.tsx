import { Icon05 } from './icons';
import { IconChevronUp } from './icons/mask-icons';
import type { FaqGroup } from '@/lib/site-faq';

/**
 * FAQ accordion.
 *
 * Reference: a 10px panel with 20px/26px padding and a 16px gap between the
 * header row and the answer. Closed it is surface-alt with an accent 20/24
 * w600 question and a 24x25 chevron pushed to the right edge; open - and, in
 * the reference, also under the pointer - the panel turns accent, the question
 * turns white and the chevron flips to its white mirror. The answer is 18/24 w500 in
 * surface-alt and spans 90% of the content width; the question box takes 0.9
 * of what the row leaves after the chevron.
 *
 * Built on `details`/`summary`, so it works with no JavaScript at all (plan
 * section 4.2.3) and every item toggles independently, as in the reference.
 * The first question of the first group starts open, again as in the
 * reference.
 */
export function FaqAccordion({ group, openFirst }: { group: FaqGroup; openFirst?: boolean }) {
  return (
    <section className="site-faq-group">
      <h3 className="site-faq-group-title">{group.title}</h3>
      <div className="site-faq-list">
        {group.items.map((item, index) => {
          const initial = openFirst === true && index === 0;
          return (
          <details
            className={initial ? 'site-faq-item site-faq-item--initial' : 'site-faq-item'}
            key={item.index}
            open={initial}
          >
            <summary className="site-faq-head">
              <h4 className="site-faq-question">{item.question}</h4>
              <span className="site-faq-icon" aria-hidden="true">
                <Icon05 className="site-faq-icon-closed" />
                <IconChevronUp className="site-faq-icon-open" />
              </span>
            </summary>
            <p className="site-faq-answer">{item.answer}</p>
          </details>
          );
        })}
      </div>
    </section>
  );
}
