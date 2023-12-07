const ticketIdFromDisplayUrlRegex = /Display\.html\?id=(\d+)/;
const ticketIdFromTimerUrlRegex = /TicketTimer\?id=(\d+)/;
const ticketIdFromTitleRegex = /#(\d+):.*/;

let timers = {};
let tabs = {};
let all_tabs;

function logTabs(allTabs) {
    console.log("logTabs: Storing all ticket related tabs");
    all_tabs = allTabs;
    tabs = {};
    for (const tab of allTabs) {
        tabs[tab.id] = tab;
        console.log("logTabs: Tab URL:", tab.url);
        console.log("Tab ID:", tab.id);
    }
}

function handleUpdated(tabId, changeInfo, tabInfo) {
    console.log("Title", tabInfo.title);
    console.log("URL", tabInfo.url);

    browser.tabs.query({
        url: "*://ticket.bywatersolutions.com/*"
    }).then(logTabs); // <-- is this blocking? It needs to be.

    const url = tabInfo.url;
    if (url.indexOf('https://ticket.bywatersolutions.com/Ticket/Display.html?id=') == 0) {
        const matches = url.match(ticketIdFromDisplayUrlRegex);
        const id = matches[1];
        console.log("TICKET: ", id);

        if (!timers[id]) {
            timers[id] = true;
            const timer_url = `https://ticket.bywatersolutions.com/Helpers/TicketTimer?id=${id}`;
            console.log("OPEN", timer_url);
            browser.windows.create({
                url: timer_url,
                focused: false,
                height: 300,
                width: 200,
                top: 0,
                left: 0,
                type: 'popup'
            });
        }
    }
}
browser.tabs.onUpdated.addListener(handleUpdated, {
    urls: ["*://ticket.bywatersolutions.com/*"]
});

function handleRemoved(tabId, removeInfo) {
    console.log(`Tab: ${tabId} is closing`);
    const tab = tabs[tabId];
    let timer_window;
    let other_tabs_open = false;
    if (tab) {
        console.log("Found the closed tab", tab);
        delete tabs[tabId];

        browser.tabs.query({
            url: "*://ticket.bywatersolutions.com/*"
        }).then(logTabs); // <-- is this blocking? It needs to be.

        const url = tab.url;
        const title = tab.title;

        console.log("Closed tab url", url);
        console.log("Closed tab title", title);

        const matches = url.match(ticketIdFromDisplayUrlRegex);
        if (!matches) return;
        const ticket_id = matches[1];
        console.log("TICKET ID: ", ticket_id);

        console.log("Looking for other tabs for this ticket");
        for (const [id, t] of Object.entries(tabs)) {
            //  Find any non timer tabs with matching titles, if there are any, don't submit the timer
            console.log(id, t);
            console.log("Tab id", t.id);
            console.log("Tab url", t.url);
            console.log("Tab title", t.title);

            // Check to see if this is another normal tab for that ticket
            let m = t.url.match(ticketIdFromDisplayUrlRegex);
            console.log('MATCHES', m);
            if (m) {
                let t_id = m[1];
                console.log("Ticket ID for this tab if Display:", t_id);
                if (t_id == ticket_id) {
                    console.log("This tab is a match!");
                    other_tabs_open = true;
                    break; // If there is another tab open, we do nothing
                }
            }

            // Check to see if this is the timer window for that ticket
            m = t.url.match(ticketIdFromTimerUrlRegex);
            if (m) {
                let t_id = m[1];
                console.log("Ticket ID for this tab if Timer", t_id);
                if (t_id == ticket_id) {
                    console.log("This tab is the timer window!");
                    timer_window = t;
                }
            }
        }

        if (timer_window && !other_tabs_open) {
            console.log("SUBMIT THE TIMER!!!!");
            browser.tabs.executeScript(timer_window.id, {
                code: 'document.querySelector("a.submit-time").click();'
            });
        } else {
            console.log("KLDFSJSDKLFJDSFKLJSDFLK");
        }
    }
}
browser.tabs.onRemoved.addListener(handleRemoved);
