/**
 * AB Test IN-4868 Dashboard - Main Logic
 * Все динамические функции и фильтрация
 */

// Глобальное состояние
const state = {
    rawData: null,
    chartsInitialized: false
};

/**
 * Нормализация даты в формат YYYY-MM-DD
 */
function normalizeDate(date) {
    if (!date) return null;
    if (typeof date === 'string') {
        return date.substring(0, 10);
    }
    if (date instanceof Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return String(date).substring(0, 10);
}

/**
 * Фильтрация данных по тур-операторам и платформам
 */
function filterData(selectedOperators, selectedPlatforms) {
    if (!state.rawData) {
        console.error('rawData not loaded');
        return null;
    }

    if (selectedOperators.length === 0 || selectedPlatforms.length === 0) {
        return {
            aggregated: {},
            dailyAggregated: [],
            searchUsersAggregated: {},
            dailySearchUsersAggregated: [],
            dates: state.rawData.dates
        };
    }

    // Фильтрация основных данных
    const filteredDf = state.rawData.df.filter(row =>
        row.tour_operator && selectedOperators.includes(row.tour_operator) &&
        row.platform && selectedPlatforms.includes(row.platform)
    );

    // Фильтрация дневных данных
    const filteredDailyDf = state.rawData.daily_df.filter(row =>
        row.tour_operator && selectedOperators.includes(row.tour_operator) &&
        row.platform && selectedPlatforms.includes(row.platform)
    );

    // Агрегация по variant
    const aggregated = {};
    filteredDf.forEach(row => {
        if (!row.variant) return;
        if (!aggregated[row.variant]) {
            aggregated[row.variant] = {
                total_orders: 0,
                unique_users: 0,
                paid_orders: 0,
                paid_revenue: 0
            };
        }
        aggregated[row.variant].total_orders += Number(row.total_orders) || 0;
        aggregated[row.variant].unique_users += Number(row.unique_users) || 0;
        aggregated[row.variant].paid_orders += Number(row.paid_orders) || 0;
        aggregated[row.variant].paid_revenue += Number(row.paid_revenue) || 0;
    });

    // Расчет AOV
    Object.keys(aggregated).forEach(variant => {
        aggregated[variant].avg_paid_order_value =
            aggregated[variant].paid_orders > 0
                ? aggregated[variant].paid_revenue / aggregated[variant].paid_orders
                : 0;
    });

    // Агрегация дневных данных
    const dailyAggregated = {};
    filteredDailyDf.forEach(row => {
        if (!row.date || !row.variant) return;
        const normalizedDate = normalizeDate(row.date);
        const key = `${normalizedDate}_${row.variant}`;
        if (!dailyAggregated[key]) {
            dailyAggregated[key] = {
                date: normalizedDate,
                variant: row.variant,
                orders: 0,
                unique_users: 0,
                paid_orders: 0,
                paid_revenue: 0
            };
        }
        dailyAggregated[key].orders += Number(row.orders) || 0;
        dailyAggregated[key].unique_users += Number(row.unique_users) || 0;
        dailyAggregated[key].paid_orders += Number(row.paid_orders) || 0;
        dailyAggregated[key].paid_revenue += Number(row.paid_revenue) || 0;
    });

    // Фильтрация search_users по платформе
    const filteredSearchUsers = state.rawData.search_users.filter(row =>
        row.platform && selectedPlatforms.includes(row.platform)
    );

    // Агрегация search users по variant
    const searchUsersAggregated = {};
    filteredSearchUsers.forEach(row => {
        if (!row.variant) return;
        if (!searchUsersAggregated[row.variant]) {
            searchUsersAggregated[row.variant] = 0;
        }
        searchUsersAggregated[row.variant] += Number(row.unique_users_search) || 0;
    });

    // Фильтрация daily_search_users по платформе
    const filteredDailySearchUsers = state.rawData.daily_search_users.filter(row =>
        row.platform && selectedPlatforms.includes(row.platform)
    );

    // Агрегация дневных search users
    const dailySearchUsersAggregated = {};
    filteredDailySearchUsers.forEach(row => {
        if (!row.date || !row.variant) return;
        const normalizedDate = normalizeDate(row.date);
        const key = `${normalizedDate}_${row.variant}`;
        if (!dailySearchUsersAggregated[key]) {
            dailySearchUsersAggregated[key] = {
                date: normalizedDate,
                variant: row.variant,
                unique_users_search: 0
            };
        }
        dailySearchUsersAggregated[key].unique_users_search += Number(row.unique_users_search) || 0;
    });

    return {
        aggregated,
        dailyAggregated: Object.values(dailyAggregated),
        searchUsersAggregated,
        dailySearchUsersAggregated: Object.values(dailySearchUsersAggregated),
        dates: state.rawData.dates
    };
}

/**
 * Обновление всех графиков и метрик
 */
function updateCharts() {
    const checkboxes = document.querySelectorAll('.tour-operator-filter:checked');
    let selectedOperators = Array.from(checkboxes).map(cb => cb.value);

    if (selectedOperators.length === 0) {
        const allOperatorCheckboxes = document.querySelectorAll('.tour-operator-filter');
        selectedOperators = Array.from(allOperatorCheckboxes).map(cb => cb.value);
    }

    const platformCheckboxes = document.querySelectorAll('.platform-filter:checked');
    let selectedPlatforms = Array.from(platformCheckboxes).map(cb => cb.value);

    if (selectedPlatforms.length === 0) {
        const allPlatformCheckboxes = document.querySelectorAll('.platform-filter');
        selectedPlatforms = Array.from(allPlatformCheckboxes).map(cb => cb.value);
    }

    const filtered = filterData(selectedOperators, selectedPlatforms);

    if (!filtered || Object.keys(filtered.aggregated).length === 0) {
        console.warn('No data after filtering');
        return;
    }

    const aData = filtered.aggregated['a'] || {};
    const bData = filtered.aggregated['b'] || {};

    // Расчет метрик
    const users_search_a = filtered.searchUsersAggregated?.a || 0;
    const users_search_b = filtered.searchUsersAggregated?.b || 0;
    const paid_a = aData.paid_orders || 0;
    const paid_b = bData.paid_orders || 0;
    const orders_a = aData.total_orders || 0;
    const orders_b = bData.total_orders || 0;
    const revenue_a = aData.paid_revenue || 0;
    const revenue_b = bData.paid_revenue || 0;

    const cvr_a = users_search_a > 0 ? (paid_a / users_search_a * 100) : 0;
    const cvr_b = users_search_b > 0 ? (paid_b / users_search_b * 100) : 0;
    const rpv_a = users_search_a > 0 ? (revenue_a / users_search_a) : 0;
    const rpv_b = users_search_b > 0 ? (revenue_b / users_search_b) : 0;
    const aov_a = paid_a > 0 ? (revenue_a / paid_a) : 0;
    const aov_b = paid_b > 0 ? (revenue_b / paid_b) : 0;

    // Подготовка дневных данных
    const dailyA = filtered.dailyAggregated
        .filter(r => r.variant === 'a')
        .map(r => ({ ...r, date: normalizeDate(r.date) }))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const dailyB = filtered.dailyAggregated
        .filter(r => r.variant === 'b')
        .map(r => ({ ...r, date: normalizeDate(r.date) }))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const dates = filtered.dates.map(normalizeDate);

    const orders_a_daily = dates.map(d => {
        const dayData = dailyA.find(r => normalizeDate(r.date) === d);
        return dayData ? (Number(dayData.orders) || 0) : 0;
    });
    const orders_b_daily = dates.map(d => {
        const dayData = dailyB.find(r => normalizeDate(r.date) === d);
        return dayData ? (Number(dayData.orders) || 0) : 0;
    });
    const paid_a_daily = dates.map(d => {
        const dayData = dailyA.find(r => normalizeDate(r.date) === d);
        return dayData ? (Number(dayData.paid_orders) || 0) : 0;
    });
    const paid_b_daily = dates.map(d => {
        const dayData = dailyB.find(r => normalizeDate(r.date) === d);
        return dayData ? (Number(dayData.paid_orders) || 0) : 0;
    });

    // Дневные search users
    const dailySearchA = filtered.dailySearchUsersAggregated
        .filter(r => r.variant === 'a')
        .map(r => ({ ...r, date: normalizeDate(r.date) }))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const dailySearchB = filtered.dailySearchUsersAggregated
        .filter(r => r.variant === 'b')
        .map(r => ({ ...r, date: normalizeDate(r.date) }))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const search_users_a_daily = dates.map(d => {
        const dayData = dailySearchA.find(r => normalizeDate(r.date) === d);
        return dayData ? (Number(dayData.unique_users_search) || 0) : 0;
    });
    const search_users_b_daily = dates.map(d => {
        const dayData = dailySearchB.find(r => normalizeDate(r.date) === d);
        return dayData ? (Number(dayData.unique_users_search) || 0) : 0;
    });

    const cvr_users_a_daily = paid_a_daily.map((p, i) => {
        const users = Number(search_users_a_daily[i]) || 0;
        return users > 0 ? (Number(p) / users * 100) : 0;
    });
    const cvr_users_b_daily = paid_b_daily.map((p, i) => {
        const users = Number(search_users_b_daily[i]) || 0;
        return users > 0 ? (Number(p) / users * 100) : 0;
    });

    const payrate_a_daily = orders_a_daily.map((o, i) => {
        const orders = Number(o) || 0;
        const paid = Number(paid_a_daily[i]) || 0;
        return orders > 0 ? (paid / orders * 100) : 0;
    });
    const payrate_b_daily = orders_b_daily.map((o, i) => {
        const orders = Number(o) || 0;
        const paid = Number(paid_b_daily[i]) || 0;
        return orders > 0 ? (paid / orders * 100) : 0;
    });

    // Выбор функции для создания/обновления графиков
    const plotFunc = state.chartsInitialized ? Plotly.react : Plotly.newPlot;

    if (state.chartsInitialized) {
        Plotly.redraw('ordersChart');
    }

    // Заказы по дням
    plotFunc('ordersChart', [
        {
            x: dates,
            y: orders_a_daily,
            name: 'A (контроль)',
            type: 'bar',
            marker: { color: '#3498db' }
        },
        {
            x: dates,
            y: orders_b_daily,
            name: 'B (скидка)',
            type: 'bar',
            marker: { color: '#9b59b6' }
        }
    ], {
        barmode: 'group',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        margin: { t: 20, r: 20, b: 40, l: 50 },
        legend: { orientation: 'h', y: -0.2 },
        xaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { gridcolor: 'rgba(255,255,255,0.1)', title: 'Заказы' }
    }, { responsive: true });

    // Оплаты по дням
    plotFunc('paymentsChart', [
        {
            x: dates,
            y: paid_a_daily,
            name: 'A (контроль)',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#3498db', width: 3 },
            marker: { size: 8 }
        },
        {
            x: dates,
            y: paid_b_daily,
            name: 'B (скидка)',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#9b59b6', width: 3 },
            marker: { size: 8 }
        }
    ], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        margin: { t: 20, r: 20, b: 40, l: 50 },
        legend: { orientation: 'h', y: -0.2 },
        xaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { gridcolor: 'rgba(255,255,255,0.1)', title: 'Оплаты' }
    }, { responsive: true });

    // CVR по дням
    plotFunc('cvrUsersChart', [
        {
            x: dates,
            y: cvr_users_a_daily,
            name: 'A (контроль)',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#3498db', width: 3 },
            marker: { size: 8 },
            hovertemplate: '%{x}<br>A: %{y:.1f}%<extra></extra>'
        },
        {
            x: dates,
            y: cvr_users_b_daily,
            name: 'B (скидка)',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#9b59b6', width: 3 },
            marker: { size: 8 },
            hovertemplate: '%{x}<br>B: %{y:.1f}%<extra></extra>'
        }
    ], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        margin: { t: 20, r: 20, b: 40, l: 60 },
        legend: { orientation: 'h', y: -0.2 },
        xaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { gridcolor: 'rgba(255,255,255,0.1)', title: 'CVR', ticksuffix: '%' }
    }, { responsive: true });

    // Pay-through по дням
    plotFunc('payRateChart', [
        {
            x: dates,
            y: payrate_a_daily,
            name: 'A (контроль)',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#3498db', width: 3 },
            marker: { size: 8 },
            hovertemplate: '%{x}<br>A: %{y:.1f}%<extra></extra>'
        },
        {
            x: dates,
            y: payrate_b_daily,
            name: 'B (скидка)',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#9b59b6', width: 3 },
            marker: { size: 8 },
            hovertemplate: '%{x}<br>B: %{y:.1f}%<extra></extra>'
        }
    ], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        margin: { t: 20, r: 20, b: 40, l: 60 },
        legend: { orientation: 'h', y: -0.2 },
        xaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { gridcolor: 'rgba(255,255,255,0.1)', title: 'Pay-through', ticksuffix: '%' }
    }, { responsive: true });

    // Воронка 1: Поиск → Заказы
    const orders_pct_a = users_search_a > 0 ? (orders_a / users_search_a * 100) : 0;
    const orders_pct_b = users_search_b > 0 ? (orders_b / users_search_b * 100) : 0;

    plotFunc('funnelChart1', [
        {
            type: 'funnel',
            name: 'A (контроль)',
            y: ['Поиск', 'Заказы'],
            x: [100, orders_pct_a],
            text: [String(users_search_a).replace(/\B(?=(\d{3})+(?!\d))/g, ','), String(orders_a).replace(/\B(?=(\d{3})+(?!\d))/g, ',')],
            textposition: 'inside',
            marker: { color: '#3498db' },
            textfont: { color: '#fff' },
            hovertemplate: '%{y}<br>Пользователей: %{text}<br>Доля от поиска: %{x:.2f}%<extra></extra>'
        },
        {
            type: 'funnel',
            name: 'B (скидка)',
            y: ['Поиск', 'Заказы'],
            x: [100, orders_pct_b],
            text: [String(users_search_b).replace(/\B(?=(\d{3})+(?!\d))/g, ','), String(orders_b).replace(/\B(?=(\d{3})+(?!\d))/g, ',')],
            textposition: 'inside',
            marker: { color: '#9b59b6' },
            textfont: { color: '#fff' },
            hovertemplate: '%{y}<br>Пользователей: %{text}<br>Доля от поиска: %{x:.2f}%<extra></extra>'
        }
    ], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        margin: { t: 20, r: 20, b: 20, l: 100 },
        legend: { orientation: 'h', y: -0.1 },
        funnelmode: 'group'
    }, { responsive: true });

    // Воронка 2: Заказы → Оплаты
    const pay_through_pct_a = orders_a > 0 ? (paid_a / orders_a * 100) : 0;
    const pay_through_pct_b = orders_b > 0 ? (paid_b / orders_b * 100) : 0;

    plotFunc('funnelChart2', [
        {
            type: 'funnel',
            name: 'A (контроль)',
            y: ['Заказы', 'Оплаты'],
            x: [100, pay_through_pct_a],
            text: [String(orders_a).replace(/\B(?=(\d{3})+(?!\d))/g, ','), String(paid_a).replace(/\B(?=(\d{3})+(?!\d))/g, ',')],
            textposition: 'inside',
            marker: { color: '#3498db' },
            textfont: { color: '#fff' },
            hovertemplate: '%{y}<br>Количество: %{text}<br>Доля от заказов: %{x:.2f}%<extra></extra>'
        },
        {
            type: 'funnel',
            name: 'B (скидка)',
            y: ['Заказы', 'Оплаты'],
            x: [100, pay_through_pct_b],
            text: [String(orders_b).replace(/\B(?=(\d{3})+(?!\d))/g, ','), String(paid_b).replace(/\B(?=(\d{3})+(?!\d))/g, ',')],
            textposition: 'inside',
            marker: { color: '#9b59b6' },
            textfont: { color: '#fff' },
            hovertemplate: '%{y}<br>Количество: %{text}<br>Доля от заказов: %{x:.2f}%<extra></extra>'
        }
    ], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        margin: { t: 20, r: 20, b: 20, l: 100 },
        legend: { orientation: 'h', y: -0.1 },
        funnelmode: 'group'
    }, { responsive: true });

    // Обновление метрик на странице
    updateMetrics({
        cvr_a, cvr_b, cvr_lift: cvr_a > 0 ? ((cvr_b - cvr_a) / cvr_a * 100) : 0,
        rpv_a, rpv_b, rpv_lift: rpv_a > 0 ? ((rpv_b - rpv_a) / rpv_a * 100) : 0,
        aov_a, aov_b, aov_lift: aov_a > 0 ? ((aov_b - aov_a) / aov_a * 100) : 0,
        users_search_a, users_search_b,
        orders_a, orders_b,
        paid_a, paid_b,
        revenue_a, revenue_b,
        ttv_b: revenue_b,
        discount_loss_b: revenue_b * 0.01015,
        aov_uplift_earnings: (aov_b - aov_a) * paid_b
    });

    state.chartsInitialized = true;
}

/**
 * Обновление метрик на странице
 */
function updateMetrics(metrics) {
    // CVR
    const cvrCard = document.querySelectorAll('.metric-card')[0];
    if (cvrCard) {
        const valueA = cvrCard.querySelector('.value-box.a .value');
        const valueB = cvrCard.querySelector('.value-box.b .value');
        const liftEl = cvrCard.querySelector('.lift');
        if (valueA) valueA.textContent = metrics.cvr_a.toFixed(2) + '%';
        if (valueB) valueB.textContent = metrics.cvr_b.toFixed(2) + '%';
        if (liftEl) {
            liftEl.textContent = (metrics.cvr_lift >= 0 ? '+' : '') + metrics.cvr_lift.toFixed(1) + '%';
            liftEl.className = 'lift ' + (metrics.cvr_lift < 0 ? 'negative' : 'positive');
        }
    }

    // RPV
    const rpvCard = document.querySelectorAll('.metric-card')[1];
    if (rpvCard) {
        const valueA = rpvCard.querySelector('.value-box.a .value');
        const valueB = rpvCard.querySelector('.value-box.b .value');
        const liftEl = rpvCard.querySelector('.lift');
        if (valueA) valueA.textContent = Math.round(metrics.rpv_a).toLocaleString('ru-RU') + '₽';
        if (valueB) valueB.textContent = Math.round(metrics.rpv_b).toLocaleString('ru-RU') + '₽';
        if (liftEl) {
            liftEl.textContent = (metrics.rpv_lift >= 0 ? '+' : '') + metrics.rpv_lift.toFixed(1) + '%';
            liftEl.className = 'lift ' + (metrics.rpv_lift < 0 ? 'negative' : 'positive');
        }
    }

    // AOV
    const aovCard = document.querySelectorAll('.metric-card')[2];
    if (aovCard) {
        const valueA = aovCard.querySelector('.value-box.a .value');
        const valueB = aovCard.querySelector('.value-box.b .value');
        const liftEl = aovCard.querySelector('.lift');
        if (valueA) valueA.textContent = Math.round(metrics.aov_a).toLocaleString('ru-RU') + '₽';
        if (valueB) valueB.textContent = Math.round(metrics.aov_b).toLocaleString('ru-RU') + '₽';
        if (liftEl) {
            liftEl.textContent = (metrics.aov_lift >= 0 ? '+' : '') + metrics.aov_lift.toFixed(1) + '%';
            liftEl.className = 'lift ' + (metrics.aov_lift < 0 ? 'negative' : 'positive');
        }
    }

    // Target card
    const targetCard = document.querySelector('.target-card');
    if (targetCard) {
        const statusEl = targetCard.querySelector('.status');
        const detailsEl = targetCard.querySelector('.details');
        if (metrics.rpv_lift >= 5) {
            statusEl.textContent = '✅ ДОСТИГНУТ';
            statusEl.style.color = '#27ae60';
        } else {
            statusEl.textContent = '❌ НЕ ДОСТИГНУТ';
            statusEl.style.color = '#e74c3c';
        }
        detailsEl.textContent = 'Факт: ' + (metrics.rpv_lift >= 0 ? '+' : '') + metrics.rpv_lift.toFixed(1) + '%';
    }

    // Split bar
    const totalUsers = metrics.users_search_a + metrics.users_search_b;
    if (totalUsers > 0) {
        const splitA = document.querySelector('.split-bar .a');
        const splitB = document.querySelector('.split-bar .b');
        if (splitA && splitB) {
            const pctA = (metrics.users_search_a / totalUsers * 100).toFixed(1);
            const pctB = (metrics.users_search_b / totalUsers * 100).toFixed(1);
            splitA.style.width = pctA + '%';
            splitA.textContent = pctA + '%';
            splitB.style.width = pctB + '%';
            splitB.textContent = pctB + '%';
        }
    }
}

/**
 * Генерация фильтров динамически из данных
 */
function generateFilters(data) {
    // Тур-операторы
    const tourOperators = [...new Set(data.df.map(r => r.tour_operator).filter(Boolean))].sort();
    const operatorsContainer = document.getElementById('tour-operators-filters');
    if (operatorsContainer) {
        operatorsContainer.innerHTML = `
            <div class="filter-checkbox">
                <input type="checkbox" id="filter-all" checked>
                <label for="filter-all">Все тур-операторы</label>
            </div>
            ${tourOperators.map((op, i) => `
                <div class="filter-checkbox">
                    <input type="checkbox" id="filter-${i}" class="tour-operator-filter" value="${op}" checked>
                    <label for="filter-${i}">${op}</label>
                </div>
            `).join('')}
        `;
    }

    // Платформы
    const platforms = [...new Set(data.df.map(r => r.platform).filter(Boolean))].sort();
    const platformsContainer = document.getElementById('platforms-filters');
    if (platformsContainer) {
        platformsContainer.innerHTML = `
            <div class="filter-checkbox">
                <input type="checkbox" id="platform-filter-all" checked>
                <label for="platform-filter-all">Все платформы</label>
            </div>
            ${platforms.map((p, i) => `
                <div class="filter-checkbox">
                    <input type="checkbox" id="platform-filter-${i}" class="platform-filter" value="${p}" checked>
                    <label for="platform-filter-${i}">${p}</label>
                </div>
            `).join('')}
        `;
    }

    return { tourOperators, platforms };
}

/**
 * Инициализация дашборда
 */
async function initDashboard() {
    try {
        // Загрузка данных
        const response = await fetch('data.json');
        const data = await response.json();

        // Нормализация дат
        data.dates = data.dates.map(normalizeDate);
        data.daily_df.forEach(row => {
            row.date = normalizeDate(row.date);
        });
        data.daily_search_users.forEach(row => {
            row.date = normalizeDate(row.date);
        });

        state.rawData = data;

        console.log('Данные загружены:', {
            orders: data.df.length,
            daily: data.daily_df.length,
            search: data.search_users.length
        });

        // Генерация фильтров
        generateFilters(data);

        // Настройка обработчиков фильтров
        setupFilterListeners();

        // Первичная отрисовка графиков
        updateCharts();

    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        document.body.innerHTML = '<div style="padding: 50px; text-align: center;"><h1>❌ Ошибка загрузки данных</h1><p>Убедитесь, что файл data.json существует</p></div>';
    }
}

/**
 * Настройка обработчиков фильтров
 */
function setupFilterListeners() {
    // Тур-операторы
    const allCheckbox = document.getElementById('filter-all');
    const operatorCheckboxes = document.querySelectorAll('.tour-operator-filter');

    allCheckbox.addEventListener('change', function() {
        operatorCheckboxes.forEach(cb => {
            cb.checked = this.checked;
        });
        updateCharts();
    });

    operatorCheckboxes.forEach(cb => {
        cb.addEventListener('change', function() {
            const allChecked = Array.from(operatorCheckboxes).every(c => c.checked);
            const someChecked = Array.from(operatorCheckboxes).some(c => c.checked);
            allCheckbox.checked = allChecked;
            if (someChecked && !allChecked) {
                allCheckbox.indeterminate = true;
            } else {
                allCheckbox.indeterminate = false;
            }
            updateCharts();
        });
    });

    // Платформы
    const platformAllCheckbox = document.getElementById('platform-filter-all');
    const platformCheckboxes = document.querySelectorAll('.platform-filter');

    platformAllCheckbox.addEventListener('change', function() {
        platformCheckboxes.forEach(cb => {
            cb.checked = this.checked;
        });
        updateCharts();
    });

    platformCheckboxes.forEach(cb => {
        cb.addEventListener('change', function() {
            const allChecked = Array.from(platformCheckboxes).every(c => c.checked);
            const someChecked = Array.from(platformCheckboxes).some(c => c.checked);
            platformAllCheckbox.checked = allChecked;
            if (someChecked && !allChecked) {
                platformAllCheckbox.indeterminate = true;
            } else {
                platformAllCheckbox.indeterminate = false;
            }
            updateCharts();
        });
    });
}

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', initDashboard);
