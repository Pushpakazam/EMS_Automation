const path = require('path');
const { test } = require('@playwright/test');
const { AddChargerPage } = require('../pages/AddChargerPage');

const IMAGE_PATH = path.join("C:\\Users\\pushp\\Downloads\\qrcode(y14rtq).png");

const testData = [
  { segment: 'Fleet', subsegments: ['Kazam Hub', 'Customer Hub'] },
  {
    segment: 'Enroute',
    subsegments: [
      'Warehouse',
      'Car Bike Showroom',
      'Hotel',
      'Car Bike Service Center',
      'Hostel',
      'Resort',
      'Garage',
      'General Store',
      'Cafe',
      'Petrol Pump',
      'Educational Institute',
      'Restaurant',
      'Mall',
      'Bank',
      'Railway Station'
    ]
  },
  { segment: 'RWA', subsegments: ['None'] },
  { segment: 'Workplace', subsegments: ['Factory', 'Corporate Office'] }
];

const parkingTypes = ['2W', '3W', '4W', 'BUS', 'TRUCK'];
const chargerTypes = ['AC', 'DC'];

const connectorTypes = [
  '3 Pin Socket',
  'CCS',
  'Industrial',
  'Industrial (with connector)',
  'GB/T',
  'CHAdeMO',
  'Type 1 Plug',
  'Type 2 Plug',
  'Type 6 Plug',
  'Type 7 Plug',
  'Chogori'
];

const capacities = ['3.3', '7.4'];

function getParkingSelection(index) {
  const primary = parkingTypes[index % parkingTypes.length];

  if (index % 3 === 1) {
    const secondary = parkingTypes[(index + 1) % parkingTypes.length];
    return [primary, secondary];
  }

  return primary;
}

test('FINAL COMPLETE FLOW', async ({ browser }) => {
  test.setTimeout(20 * 60 * 1000);
  const maxIterations = Infinity;

  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 12.9716, longitude: 77.5946 }
  });

  const page = await context.newPage();
  const add = new AddChargerPage(page);

  try {
    await add.login('pushpa@kazam.in', 'Shivanna@123');

    let i = 0;
    let firstRun = true;

  outerLoop:
for (const seg of testData) {
  for (const sub of seg.subsegments) {
  if (i >= maxIterations) {
  break outerLoop;

}
        if (firstRun) {
          await add.openAddCharger();
        } else {
          await add.clickAddMore();
        }

        const capacity = capacities[i % capacities.length];
        const connectorCount = ((i % 4) + 1).toString();
        const connectorType = connectorTypes[i % connectorTypes.length];
        const parkingSelection = getParkingSelection(i);
        const parkingSummary = AddChargerPage.formatParkingSelection(parkingSelection);
        const open247 = i % 2 === 0 ? 'Yes' : 'No';

        const total = parseFloat(capacity);
        const count = parseInt(connectorCount);
        const base = Math.floor((total / count) * 100) / 100;
        const perConnectorCapacity = base.toFixed(2);

        await add.fillStep1({
          name: AddChargerPage.generateChargerName(),
          host: '9876543210',
          segment: seg.segment,
          subsegment: sub,
          capacity,
          type: chargerTypes[i % chargerTypes.length],
          parking: parkingSelection
        });

        await add.fillStep2({
          count: connectorCount,
          type: connectorType,
          capacity: perConnectorCapacity
        });

        await add.fillStep3({
          latitude: '12.9716',
          longitude: '77.5946'
        });

        const scheduleSummary = await add.fillStep4({
          private: i % 2 === 0 ? 'Yes' : 'No',
          open247,
          filePath: IMAGE_PATH,
          dayIndex: i
        });

        console.log(
          `#${i + 1} | Segment:${seg.segment} | Sub:${sub} | Type:${chargerTypes[i % chargerTypes.length]} | Parking:${parkingSummary} | Conn:${connectorCount} | ConnType:${connectorType} | Capacity:${capacity} | Open247:${open247} | Schedule:${scheduleSummary}`
        );

        i++;
        firstRun = false;
      }
    }
  } finally {
    await context.close();
  }
});
