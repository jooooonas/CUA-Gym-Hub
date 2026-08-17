const FIXTURE_IDS = Object.freeze({
  deliveredOrder: 'fixture-order-delivered',
  dessert: 'fixture-dessert',
  homeAddress: 'fixture-address-home',
  pizza: 'fixture-pizza',
  restaurant: 'fixture-restaurant',
  user: 'fixture-user'
});

const FIXTURE_VALUES = Object.freeze({
  dessertName: 'Contract Tiramisu',
  homeStreet: '101 Fixture Avenue',
  pizzaName: 'Contract Pizza',
  restaurantName: 'CUA Fixture Kitchen',
  userName: 'CUA Fixture User'
});

function createInjectedStateFixture() {
  return {
    user: {
      id: FIXTURE_IDS.user,
      name: FIXTURE_VALUES.userName,
      email: 'fixture.user@example.test',
      phone: '(555) 010-0200',
      avatarUrl: '',
      addresses: [
        {
          id: FIXTURE_IDS.homeAddress,
          label: 'Home',
          street: FIXTURE_VALUES.homeStreet,
          apt: 'Apt 1',
          city: 'Test City',
          state: 'CA',
          zip: '94102',
          instructions: 'Use the fixture entrance',
          isDefault: true
        },
        {
          id: 'fixture-address-work',
          label: 'Work',
          street: '202 Schema Street',
          apt: 'Suite 2',
          city: 'Test City',
          state: 'CA',
          zip: '94105',
          instructions: '',
          isDefault: false
        }
      ],
      defaultAddressId: FIXTURE_IDS.homeAddress,
      paymentMethods: [
        {
          id: 'fixture-payment',
          type: 'visa',
          label: 'Fixture Visa •••• 4242',
          last4: '4242',
          isDefault: true
        }
      ],
      defaultPaymentId: 'fixture-payment',
      uberOneActive: false,
      favoriteRestaurantIds: []
    },
    categories: [
      { id: 'fixture-category', name: 'Contract Food', icon: '🍽️' }
    ],
    restaurants: [
      {
        id: FIXTURE_IDS.restaurant,
        name: FIXTURE_VALUES.restaurantName,
        imageUrl: '',
        cuisineType: ['Contract Food', 'Pizza'],
        rating: 4.9,
        reviewCount: 42,
        priceRange: '$$',
        deliveryFee: 2.5,
        deliveryTimeMin: 20,
        deliveryTimeMax: 30,
        distance: 1.0,
        isOpen: true,
        hours: '9:00 AM - 10:00 PM',
        address: '303 Runtime Road, Test City, CA',
        phone: '(555) 010-0300',
        isSponsored: false,
        promotions: [
          {
            id: 'fixture-promotion-summary',
            type: 'fixed',
            title: '$5 off fixture orders',
            description: '$5 off qualifying orders',
            code: 'SAVE5',
            minOrder: 5,
            discountAmount: 5,
            discountPercent: null,
            expiresAt: '2099-12-31',
            restaurantId: null
          }
        ],
        categories: ['Featured', 'Desserts'],
        tags: ['Fixture', 'Vegetarian'],
        supportsPickup: true,
        pickupTimeMin: 10,
        pickupTimeMax: 15
      }
    ],
    menuItems: [
      {
        id: FIXTURE_IDS.pizza,
        restaurantId: FIXTURE_IDS.restaurant,
        category: 'Featured',
        name: FIXTURE_VALUES.pizzaName,
        description: 'A pizza supplied only by the injected runtime fixture.',
        price: 14,
        imageUrl: '',
        isPopular: true,
        isAvailable: true,
        dietaryTags: ['Vegetarian'],
        customizationGroups: [
          {
            id: 'fixture-size-group',
            name: 'Choose your size',
            required: true,
            maxSelections: 1,
            minSelections: 1,
            options: [
              {
                id: 'fixture-size-small',
                name: 'Small (10")',
                priceModifier: 0,
                isDefault: true,
                isAvailable: true
              },
              {
                id: 'fixture-size-medium',
                name: 'Medium (12")',
                priceModifier: 2,
                isDefault: false,
                isAvailable: true
              }
            ]
          },
          {
            id: 'fixture-toppings-group',
            name: 'Extra toppings',
            required: false,
            maxSelections: 3,
            minSelections: 0,
            options: [
              {
                id: 'fixture-topping-mushroom',
                name: 'Mushrooms',
                priceModifier: 1,
                isDefault: false,
                isAvailable: true
              }
            ]
          }
        ]
      },
      {
        id: FIXTURE_IDS.dessert,
        restaurantId: FIXTURE_IDS.restaurant,
        category: 'Desserts',
        name: FIXTURE_VALUES.dessertName,
        description: 'A dessert supplied only by the injected runtime fixture.',
        price: 8,
        imageUrl: '',
        isPopular: false,
        isAvailable: true,
        dietaryTags: ['Vegetarian'],
        customizationGroups: []
      }
    ],
    cart: {
      restaurantId: null,
      restaurantName: null,
      items: [],
      deliveryMode: 'delivery',
      scheduledTime: null,
      promoCode: null,
      promoDiscount: 0,
      tipAmount: 0,
      tipPercentage: 18,
      deliveryInstructions: ''
    },
    orders: [
      {
        id: FIXTURE_IDS.deliveredOrder,
        restaurantId: FIXTURE_IDS.restaurant,
        restaurantName: FIXTURE_VALUES.restaurantName,
        restaurantImageUrl: '',
        items: [
          {
            menuItemId: FIXTURE_IDS.pizza,
            name: FIXTURE_VALUES.pizzaName,
            quantity: 1,
            unitPrice: 16,
            totalPrice: 16,
            selectedOptions: ['Medium (12")'],
            specialInstructions: ''
          }
        ],
        status: 'delivered',
        placedAt: '2026-01-10T12:00:00.000Z',
        estimatedDeliveryMin: '2026-01-10T12:20:00.000Z',
        estimatedDeliveryMax: '2026-01-10T12:30:00.000Z',
        deliveredAt: '2026-01-10T12:25:00.000Z',
        deliveryAddress: {
          id: FIXTURE_IDS.homeAddress,
          label: 'Home',
          street: FIXTURE_VALUES.homeStreet,
          apt: 'Apt 1',
          city: 'Test City',
          state: 'CA',
          zip: '94102',
          instructions: '',
          isDefault: true
        },
        deliveryMode: 'delivery',
        subtotal: 16,
        serviceFee: 2.4,
        deliveryFee: 2.5,
        tax: 1.44,
        tip: 2.88,
        promoDiscount: 0,
        total: 25.22,
        paymentMethod: 'Fixture Visa •••• 4242',
        deliveryPerson: {
          id: 'fixture-driver',
          name: 'Fixture Driver',
          photoUrl: '',
          vehicleType: 'bike',
          rating: 5
        },
        rating: null,
        review: null
      }
    ],
    promotions: [
      {
        id: 'fixture-promotion',
        type: 'fixed',
        title: '$5 off fixture orders',
        description: '$5 off qualifying orders',
        code: 'SAVE5',
        minOrder: 5,
        discountAmount: 5,
        discountPercent: null,
        expiresAt: '2099-12-31',
        restaurantId: null
      }
    ],
    reviews: [
      {
        id: 'fixture-review',
        restaurantId: FIXTURE_IDS.restaurant,
        userId: 'fixture-reviewer',
        userName: 'Fixture Reviewer',
        rating: 5,
        comment: 'The external fixture rendered correctly.',
        createdAt: '2026-01-09T12:00:00.000Z',
        orderId: null
      }
    ],
    activeOrderId: null,
    ui: {
      selectedAddressId: FIXTURE_IDS.homeAddress,
      deliveryMode: 'delivery',
      searchQuery: '',
      recentSearches: ['legacy fixture search'],
      activeFilters: {
        sort: 'recommended',
        priceRange: [],
        dietary: [],
        maxDeliveryFee: null,
        deals: false
      }
    }
  };
}

module.exports = {
  FIXTURE_IDS,
  FIXTURE_VALUES,
  createInjectedStateFixture
};
