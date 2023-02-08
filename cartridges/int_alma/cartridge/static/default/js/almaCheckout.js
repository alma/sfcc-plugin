window.addEventListener('DOMContentLoaded',
    function () {

        var purchase_amount =  Number(almaContext.payment.purchaseAmount);

        /* Uses jQuery here because context.updateCheckoutViewEvent is triggered with jQuery */
        jQuery('body').on(almaContext.updateCheckoutViewEvent, async function() {
            var checkoutBtn = document.querySelector(almaContext.selector.submitPayment);
            var nextStepButton = checkoutBtn.parentElement.parentElement;
            nextStepButton.classList.add('next-step-button');
            checkoutBtn.setAttribute('type', 'submit');



            var responseOrderAmount = await fetch(almaContext.almaUrl.orderAmountUrl);
            var dataOrderAmount = await responseOrderAmount.json()
            purchase_amount = dataOrderAmount.purchase_amount;

            var response = await fetch(almaContext.almaUrl.getPlans);
            var data = await response.json()
            almaPaymentMethods = data.plans;

            for (const [indexPaymentMethod, almaPaymentMethod] of Object.entries(almaPaymentMethods)) {
                var name = almaPaymentMethod.name;
                var plans = almaPaymentMethod.plans;

                for (const [indexPlan, plan] of Object.entries(plans)) {
                    var icons = document.querySelectorAll(".alma-payment-method .fa");
                    [].forEach.call(icons, function (icon) {
                        icon.classList.remove("fa-chevron-down");
                    });

                    document.getElementById(`${plan.key + '_fragment'}`).innerHTML = "";

                    if (plan.payment_plans) {
                        document.getElementById(plan.key)
                            .removeAttribute('hidden');
                        document.getElementById(`${'alma-tab-' + plan.key + '-img'}`)
                            .removeAttribute('hidden');

                        var elementTabImg = document.getElementById(`${'alma-tab-' + plan.key + '-img'}`);
                        if (elementTabImg) {
                            elementTabImg.textContent = plan.properties.img;
                        }

                        var elementImg = document.getElementById(`${plan.key + '-img'}`);
                        if (elementImg) {
                            elementImg.textContent = plan.properties.img;
                        }

                        var elementTitle = document.getElementById(`${plan.key + '-title'}`);
                        if (elementTitle) {
                            elementTitle.textContent = plan.properties.title;
                        }

                        var elementDescription = document.getElementById(`${plan.key + '-description'}`);
                        if (elementDescription) {
                            elementDescription.textContent = plan.properties.description;
                        }

                        var elementFees = document.getElementById(`${plan.key + '-fees'}`);
                        if (elementFees) {
                            elementFees.textContent = plan.properties.fees;
                        }

                        var elementBasketCost = document.getElementById(`${plan.key + '-basket_cost'}`);
                        if (elementBasketCost) {
                            elementBasketCost.textContent = plan.properties.credit.basket_cost;
                        }

                        var elementAmount = document.getElementById(`${plan.key + '-amount'}`);
                        if (elementAmount) {
                            elementAmount.textContent = plan.properties.credit.amount;
                        }

                        var elementRate = document.getElementById(`${plan.key + '-rate'}`);
                        if (elementRate) {
                            elementRate.textContent = plan.properties.credit.rate;
                        }

                        var elementTotalCost = document.getElementById(`${plan.key + '-total_cost'}`);
                        if (elementTotalCost) {
                            elementTotalCost.textContent = plan.properties.credit.total_cost;
                        }

                        var elementPaymentInstallments = document.getElementById(`${plan.key + '-payment_installments'}`);
                        if (elementPaymentInstallments) {
                            elementPaymentInstallments.textContent = plan.properties.payment_installments;
                        }

                    } else {
                        document.getElementById(plan.key)
                            .setAttribute('hidden', 'hidden');
                        document.getElementById(`${'alma-tab-' + plan.key + '-img'}`)
                            .setAttribute('hidden', 'hidden');
                    }
                }

                if (almaPaymentMethod.hasEligiblePaymentMethod) {
                    document.getElementById(`${'alma-tab-' + name}`)
                        .removeAttribute('hidden');
                } else {
                    document.getElementById(`${'alma-tab-' + name}`)
                        .setAttribute('hidden', 'hidden');
                }
            }

        });

        var checkoutFragmentCallInProgress = false;

        var checkoutEvents = [];

        function addCheckoutEvent(event) {
            document
                .querySelector(almaContext.selector.submitPayment)
                .addEventListener('click', event)
        }

        function removeCheckoutEvents() {
            var lastEvent;
            var event = checkoutEvents.shift()
            while (event) {
                lastEvent = event;
                document
                    .querySelector(almaContext.selector.submitPayment)
                    .removeEventListener('click', event)

                event = checkoutEvents.shift()
            }

            if (lastEvent) {
                checkoutEvents.push(lastEvent);
            }
        }

        var paymentOptions = document.querySelectorAll(almaContext.selector.paymentOptions);

        paymentOptions.forEach(function (paymentOption) {
            paymentOption.addEventListener('click', removeCheckoutEvents)
        });

        /**
         * Returns the data formatted for in-page payment
         * @param  {Object} data an alma plan
         * @param  {number} installments_count number of installments
         * @param  {number} deferred_days number of days before the 1st payment
         * @returns {Object}
         */
        function getPaymentData(data, installments_count, deferred_days) {
            return {
                payment: {
                    purchase_amount: purchase_amount,
                    installments_count: installments_count,
                    deferred_days: deferred_days,
                    deferred_months: 0,
                    return_url: almaContext.payment.returnUrl,
                    ipn_callback_url: almaContext.payment.ipnCallbackUrl,
                    customer_cancel_url: almaContext.payment.customerCancelUrl,
                    locale: data.locale.split("_")[0],
                    shipping_address: data.shipping_address,
                    deferred: data.isEnableOnShipment ? "trigger" : "",
                    deferred_description: data.isEnableOnShipment ? decodeHtml(almaContext.payment.deferredDescription) : "",
                    custom_data: {
                        cms_name: data.cms_name,
                        cms_version: data.cms_version,
                        alma_plugin_version: data.alma_plugin_version
                    }
                },
                customer: data.customer
            };
        }

        /**
         * Build an in-page payment form to allow the customer to pay
         * This option is only available when installments_count is 2 or 3
         * @param  {string} container the div elem where the form will be built
         * @param  {number} installments_count number of installments
         * @param  {number} deferred_days number of days before the 1st payment
         */
        async function renderInPage(
            container,
            installments_count,
            deferred_days
        ) {
            var response = await fetch(almaContext.almaUrl.dataUrl + '?installment=' + installments_count);
            var data = await response.json();

            var paymentData = getPaymentData(data, installments_count, deferred_days)

            var fragments = new Alma.Fragments(almaContext.merchantId, {
                mode: almaContext.almaMode === 'LIVE' ? Alma.ApiMode.LIVE : Alma.ApiMode.TEST
            });

            var paymentForm = fragments.createPaymentForm(paymentData, {
                showPayButton: false,
                onSuccess: function (returnedData) {
                    window.location = returnedData.return_url;
                },
                onFailure: function () {
                    addCheckoutEvent(checkoutEvents.at(-1));
                    checkoutFragmentCallInProgress = false;
                },
                onPopupClose: function () {
                    addCheckoutEvent(checkoutEvents.at(-1));
                    checkoutFragmentCallInProgress = false;
                }
            })

            await paymentForm.mount(document.getElementById(container));
            return paymentForm;
        }

        /**
         * SFCC resource needs to be decoded to be given to Alma Fragment
         * @param {string} ressource the message to decode
         * @returns {string} the decoded string
         */
        function decodeHtml(ressource) {
            var txt = document.createElement("textarea");
            txt.innerHTML = ressource;
            return txt.value;
        }

        /*
         * Redirect to Alma website to allow the customer to pay
         * @param  {number} installments_count number of installments
         * @param  {number} deferred_days number of days before the 1st payment
         */
        async function redirectToPaymentPage(installments_count, deferred_days) {
            var response = await fetch(
                almaContext.almaUrl.createPaymentUrl + '?deferred_days=' + deferred_days + '&installments=' + installments_count,
                { method: 'POST' }
            );
            var body = await response.json();
            window.location = body.url;
        }

        /**
         * Open a payment option and hide the others
         * @param  {Object} t a JS selector
         */
        async function toggle(t) {
            removeCheckoutEvents();
            var activeElt = document.querySelector("#" + t.id + " .fa");
            var isAlreadyOpen = activeElt.classList.contains("fa-chevron-down");

            var icons = document.querySelectorAll(".alma-payment-method .fa");
            [].forEach.call(icons, function (icon) {
                icon.classList.remove("fa-chevron-down");
            });

            if (!isAlreadyOpen) {
                activeElt.classList.add("fa-chevron-down");

                var installments_count = parseInt(t.getAttribute('data-installments'));
                var deferred_days = parseInt(t.getAttribute('data-deferred-days'));
                var alma_payment_method = t.getAttribute('data-alma-payment-method');
                var in_page = t.getAttribute('data-in-page') === 'true';

                document.body.style.cursor = 'wait';
                if (in_page) {
                    await renderInPage(t.id + "_fragment", installments_count, deferred_days)
                        .then(function (paymentForm) {
                            var checkoutFragmentCall = async function () {
                                if (checkoutFragmentCallInProgress) {
                                    return;
                                }
                                checkoutFragmentCallInProgress = true;
                                var ajaxResponse = await fetch(almaContext.almaUrl.checkoutFragmentUrl + '?pid=' + paymentForm.currentPayment.id + '&amount=' + paymentForm.currentPayment.purchase_amount + '&alma_payment_method=' + alma_payment_method);
                                var orderFragment = await ajaxResponse.json();
                                switch (ajaxResponse.status) {
                                    case 200:
                                        removeCheckoutEvents();
                                        paymentForm.pay();
                                        break;
                                    case 400:
                                        displayMismatchMessage(orderFragment)
                                        checkoutFragmentCallInProgress = false;
                                        break;
                                    case 500:
                                        displayPaymentMethodNotFound(orderFragment)
                                        checkoutFragmentCallInProgress = false;
                                        break;
                                    default:
                                        displayPaymentError(ajaxResponse.status);
                                        checkoutFragmentCallInProgress = false;
                                }
                            }

                            checkoutEvents.push(checkoutFragmentCall);

                            addCheckoutEvent(checkoutFragmentCall);
                        });
                } else {
                    activeElt.parentNode.innerHTML = '<div class="alma-lds-ring"><div></div><div></div><div></div><div></div></div>';
                    await redirectToPaymentPage(installments_count, deferred_days);
                }
                document.body.style.cursor = 'default';

            } else {
                await document.getElementById(t.id + "_fragment").firstChild.remove();
            }
        }

        /**
         * Add on click event callback
         * @param  {Object} event a JS event
         */
        async function handlePaymentMethodClick(event) {
            var t = event.target;
            while (t && !(t.classList && t.classList.contains("alma-payment-method"))) {
                t = t.parentNode;
            }

            await toggle(t);
        }

        var almaPaymentMethods = document.querySelectorAll(".alma-payment-method");
        almaPaymentMethods.forEach(function (pm) {
            pm.addEventListener("click", async function (e) {
                await handlePaymentMethodClick(e);
            });
        })

        function displayMismatchMessage(orderFragment) {
            var errorMessagePosition = document.querySelectorAll(almaContext.selector.fragmentErrors)[0];
            errorMessagePosition.after(createMismatchMessage(orderFragment));
        }

        function createMismatchMessage(orderFragment) {
            var errorLink = document.createElement('a');
            var errorLinkText = document.createTextNode("Please refresh the page to try to pay again.");
            errorLink.href = '';
            errorLink.appendChild(errorLinkText);


            var errorMismatchMessage = document.createTextNode(orderFragment.error);
            var errorDiv = document.createElement('div');
            errorDiv.classList.add('col-12', 'alma-error-message');
            errorDiv.id = 'mismatch-message';
            errorDiv.appendChild(errorMismatchMessage);
            errorDiv.appendChild(document.createElement('br'));
            errorDiv.appendChild(errorLink);
            return errorDiv;
        }

        function displayPaymentMethodNotFound(orderFragment) {
            var errorMessagePosition = document.querySelectorAll(almaContext.selector.fragmentErrors)[0];
            errorMessagePosition.after(createPaymentMethodNotFound(orderFragment));
        }

        function createPaymentMethodNotFound(orderFragment) {
            var errorMessage = document.createTextNode(orderFragment.error);
            var errorDiv = document.createElement('div');
            errorDiv.classList.add('col-12', 'alma-error-message');
            errorDiv.id = 'payment-method-not-found-message';
            errorDiv.appendChild(errorMessage);
            errorDiv.appendChild(document.createElement('br'));
            return errorDiv;
        }

        function displayPaymentError(status) {
            var errorMessagePosition = document.querySelectorAll(almaContext.selector.fragmentErrors)[0];
            var errorMessage = document.createTextNode(status);
            var errorDiv = document.createElement('div');
            errorDiv.classList.add('col-12', 'alma-error-message');
            errorDiv.id = 'payment-error';
            errorDiv.appendChild(errorMessage);
            errorDiv.appendChild(document.createElement('br'));
            errorMessagePosition.after(errorDiv);
        }

    });
