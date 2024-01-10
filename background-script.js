const ticketIdFromDisplayUrlRegex = /Display\.html\?id=(\d+)/;
const ticketIdFromTimerUrlRegex = /TicketTimer\?id=(\d+)/;
const ticketIdFromTitleRegex = /#(\d+):.*/;

let tabs = {};

function logTabs(allTabs) {
  console.log("logTabs: Storing all ticket related tabs");
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

  const url = tabInfo.url;
  const matches = url.match(ticketIdFromDisplayUrlRegex);
  if ( !matches ) return; // Not a ticket tab, nothing to see here
  const ticket_id = matches[1];
  if ( !ticket_id ) return; // No ticket id? Nothing we can do then
  
  console.log("TICKET: ", ticket_id);

  // Look for a timer window 
  browser.tabs
    .query({
      url: "*://ticket.bywatersolutions.com/*",
      title: `*Timer for #${ticket_id}*`
    })
    .then(function( timerTabs ) {
        if ( timerTabs.length == 0 ) {
          const timer_url = `https://ticket.bywatersolutions.com/Helpers/TicketTimer?id=${ticket_id}`;
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
    })

  // Store all ticket tabs, needed for when a tab is closed
  browser.tabs
    .query({
      url: "*://ticket.bywatersolutions.com/*",
      title: "#*" // Ticket page titles are like "#123456: Ticket title"
    })
    .then(logTabs)
}
const debouncedHandleUpdated = debounce(handleUpdated, 1500);
browser.tabs.onUpdated.addListener(debouncedHandleUpdated, {
  urls: ["*://ticket.bywatersolutions.com/*"],
});

function handleRemoved(tabId, removeInfo) {
  console.log(`Tab ${tabId} is closing`);

  const tab = tabs[tabId];
  if ( !tab ) return;

  const url = tab.url;
  const title = tab.title;

  console.log("Found the closed tab", tab);
  console.log("Closed tab url", url);
  console.log("Closed tab title", title);

  const matches = url.match(ticketIdFromDisplayUrlRegex);
  if (!matches) return;
  const ticket_id = matches[1];
  if (!ticket_id) return;

  console.log(`FOUND TICKET FOR CLOSED TAB ${tabId}: ${ticket_id}`);

  let timer_window;
  let other_tabs_open = false;

// Is this a non-timer ticket tab?
// If so we need to submit the timer if it was the last open tab for the ticket
console.log("UPDATING TABS");
browser.tabs
  .query({
    url: "*://ticket.bywatersolutions.com/*",
  })
  .then(function( ticketTabs ) {
      for (const t of ticketTabs) {
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
browser.tabs.onRemoved.addListener(handleRemoved);

function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};
