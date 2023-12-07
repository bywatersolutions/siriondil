document.body.style.border = "5px solid blue";

const ticketIdRegex = /id=(\d+)/;

if (window.location.href.indexOf('https://ticket.bywatersolutions.com/Ticket/Display.html?id=') == 0) {
    const matches = window.location.href.match(ticketIdRegex);
    const id = matches[1];

    const timer_url = `https://ticket.bywatersolutions.com/Helpers/TicketTimer?id=${id}`;
    window.open(timer_url, '_blank', 'location=no,height=300,width=200,scrollbars=no,status=no');
}
