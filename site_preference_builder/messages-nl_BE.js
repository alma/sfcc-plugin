/* eslint-disable max-len */
exports.messages = {
  x_times_payment: {
    title: 'Activate or deactivate [[installments]]x installment payment',
    min: 'Minimum orderbedrag om [[installments]]x termijnbetaling toe te staan',
    min_disclamer: 'N.B. u kunt niet lager gaan dan [[amount]] (neem contact op met uw Alma-verkoper als u dit wilt veranderen)',
    max: 'Maximum orderbedrag om [[installments]]x termijnbetaling toe te staan',
    max_disclamer: 'N.B. U kunt niet hoger gaan dan [[amount]] (neem contact op met uw Alma-verkoper als u dit wilt wijzigen)',
    group: 'Alma [[installments]]x'
  },
  deferred_payment: {
    title: 'Activate or deactivate payment @ +[[deferredDays]] days',
    min: 'Min orderbedrag om betaling @ +[[deferredDays]] dagen toe te staan',
    min_disclamer: 'N.B. U kunt niet lager dan [[amount]] (neem contact op met uw Alma-verkoper als u dit wilt wijzigen)',
    max: 'Max orderbedrag om betaling @ +[[deferredDays]] dagen toe te staan',
    max_disclamer: 'N.B. U kunt niet hoger gaan dan [[amount]] (neem contact op met uw Alma-verkoper als u dit wilt wijzigen)',
    group: 'Alma D+[[deferredDays]]'
  },
  x_times_deferred_payment: {
    title: 'Activate or deactivate [[installments]]x installment payment @ +[[deferredDays]] days',
    min: 'Minimum orderbedrag om [[installments]]x termijnbetaling @ [[deferredDays]] dagen toe te staan',
    min_disclamer: 'N.B. u kunt niet lager gaan dan [[amount]] (neem contact op met uw Alma-verkoper als u dit wilt veranderen)',
    max: 'Maximum orderbedrag om [[installments]]x termijnbetaling toe te staan',
    max_disclamer: 'N.B. U kunt niet hoger gaan dan [[amount]] (neem contact op met uw Alma-verkoper als u dit wilt wijzigen)',
    group: 'Alma [[installments]]x @ D [[deferredDays]]'
  }
};
