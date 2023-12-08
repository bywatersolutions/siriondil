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
  console.log("logTabs: Done!");
}

function handleUpdated(tabId, changeInfo, tabInfo) {
  console.log("Title", tabInfo.title);
  console.log("URL", tabInfo.url);

  browser.tabs
    .query({
      url: "*://ticket.bywatersolutions.com/*",
    })
    .then(logTabs)
    .then(function () {
      const url = tabInfo.url;
      if (
        url.indexOf(
          "https://ticket.bywatersolutions.com/Ticket/Display.html?id=",
        ) == 0
      ) {
        const matches = url.match(ticketIdFromDisplayUrlRegex);
        const id = matches[1];
        console.log("TICKET: ", id);

        if (!timers[id]) {
          timers[id] = true;
          console.log("Timers:", timers);
          const timer_url = `https://ticket.bywatersolutions.com/Helpers/TicketTimer?id=${id}`;
          console.log("OPEN", timer_url);
          browser.windows.create({
            url: timer_url,
            focused: false,
            height: 300,
            width: 200,
            top: 0,
            left: 0,
            type: "popup",
          });
        }
      }
    });
}
browser.tabs.onUpdated.addListener(handleUpdated, {
  urls: ["*://ticket.bywatersolutions.com/*"],
});

function handleRemoved(tabId, removeInfo) {
  console.log(`Tab: ${tabId} is closing`);
  const tab = tabs[tabId];
  let timer_window;
  let other_tabs_open = false;
  if (tab) {
    console.log("Found the closed tab", tab);
    console.log("Closed tab url", tab.url);
    console.log("Closed tab title", tab.title);

    //Is this a timer tab? If so, we need to remove it from the timers hash
    const matches = tab.url.match(ticketIdFromTimerUrlRegex);
    console.log(matches);
    if (matches) {
      const ticket_id = matches[1];
      console.log(
        "This is a timer tab, removing from the timers array. Ticket id:",
        ticket_id,
      );
      timers[ticket_id] = false;
      console.log("Timers:", timers);
      return;
    }

    //Is this a non-timer ticket tab? If so we need to submit the timer if it was the last open tab for the ticket
    console.log("UPDATING TABS");
    browser.tabs
      .query({
        url: "*://ticket.bywatersolutions.com/*",
      })
      .then(logTabs)
      .then(function () {
        console.log("DONE UPDATING TABS, CHECKING FOR MORE TICKET TABS");
        delete tabs[tabId];

        const url = tab.url;
        const title = tab.title;

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
          console.log("MATCHES", m);
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
          console.log("SUBMITTING TIMER!");
          browser.tabs.executeScript(timer_window.id, {
            code: 'document.querySelector("a.submit-time").click();',
          });
        }
      });
  }
}
browser.tabs.onRemoved.addListener(handleRemoved);
