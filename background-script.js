const ticketIdFromDisplayUrlRegex = /Display\.html\?id=(\d+)/;
const ticketIdFromTimerUrlRegex = /TicketTimer\?id=(\d+)/;
const ticketIdFromTitleRegex = /#(\d+):.*/;

let all_ticket_tabs = {};

function logTabs(tabs) {
  console.log("***** LOG TABS *****");
  for (const tab of tabs) {
    console.log(`Storing ${tab.id} titled: ${tab.title}`);
    all_ticket_tabs[tab.id] = tab;
  }
}

function handleUpdated(tabId, changeInfo, tabInfo) {
  console.log("Title", tabInfo.title);
  console.log("URL", tabInfo.url);

  const url = tabInfo.url;
  const matches = url.match(ticketIdFromDisplayUrlRegex);
  if (!matches) return; // Not a ticket tab, nothing to see here
  const ticket_id = matches[1];
  if (!ticket_id) return; // No ticket id? Nothing we can do then

  all_ticket_tabs[tabId] = tabInfo;

  console.log("TICKET: ", ticket_id);

  // Look for a timer window
  browser.tabs
    .query({
      url: "*://ticket.bywatersolutions.com/*",
      title: `*Timer for #${ticket_id}*`,
    })
    .then(function (timerTabs) {
      if (timerTabs.length == 0) {
        const timer_url = `https://ticket.bywatersolutions.com/Helpers/TicketTimer?id=${ticket_id}`;
        console.log("OPEN", timer_url);
        browser.windows
          .create({
            url: timer_url,
            focused: false,
            height: 300,
            width: 200,
            top: 0,
            left: 0,
            type: "popup",
          })
          .then(function (tabInfo) {
            all_ticket_tabs[tabInfo.id] = tabInfo;
          });
      }
    })
    .then(function () {
      // Store all ticket tabs, needed for when a tab is closed
      browser.tabs
        .query({
          url: "*://ticket.bywatersolutions.com/*",
          title: "#*", // Ticket page titles are like "#123456: Ticket title"
        })
        .then(logTabs);
    });
}
const debouncedHandleUpdated = debounce(handleUpdated, 1000, true);
browser.tabs.onUpdated.addListener(debouncedHandleUpdated, {
  urls: ["*://ticket.bywatersolutions.com/*"],
});

function handleRemoved(tabId, removeInfo) {
  console.log(`Tab ${tabId} is closing`);

  const tab = all_ticket_tabs[tabId];
  if (!tab) return;

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
      title: `*Timer for #${ticket_id}*`,
    })
    .then(function (ticketTabs) {
      console.log("TIMERS", ticketTabs);
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
  // 'private' variable for instance
  // The returned function will be able to reference this due to closure.
  // Each call to the returned function will share this common timer.
  var timeout;

  // Calling debounce returns a new anonymous function
  return function () {
    // reference the context and args for the setTimeout function
    var context = this,
      args = arguments;

    // Should the function be called now? If immediate is true
    //   and not already in a timeout then the answer is: Yes
    var callNow = immediate && !timeout;

    // This is the basic debounce behaviour where you can call this
    //   function several times, but it will only execute once
    //   (before or after imposing a delay).
    //   Each time the returned function is called, the timer starts over.
    clearTimeout(timeout);

    // Set the new timeout
    timeout = setTimeout(function () {
      // Inside the timeout function, clear the timeout variable
      // which will let the next execution run when in 'immediate' mode
      timeout = null;

      // Check if the function already ran with the immediate flag
      if (!immediate) {
        // Call the original function with apply
        // apply lets you define the 'this' object as well as the arguments
        //    (both captured before setTimeout)
        func.apply(context, args);
      }
    }, wait);

    // Immediate mode and no wait timer? Execute the function...
    if (callNow) func.apply(context, args);
  };
}
